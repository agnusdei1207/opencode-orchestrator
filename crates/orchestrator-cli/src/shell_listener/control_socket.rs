use anyhow::{Context, Result, bail};
use serde_json::json;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, mpsc};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use super::control::{ControlRequest, ControlResponse};

#[derive(Debug)]
pub struct ControlEnvelope {
    pub request: ControlRequest,
    pub reply_tx: mpsc::Sender<ControlResponse>,
}

#[cfg(unix)]
pub fn spawn_control_server(
    socket_path: PathBuf,
    audit_path: PathBuf,
    control_tx: mpsc::Sender<ControlEnvelope>,
    stop: Arc<AtomicBool>,
) -> Result<thread::JoinHandle<()>> {
    use std::os::unix::net::UnixListener;
    if let Some(parent) = socket_path.parent() {
        fs::create_dir_all(parent)?;
    }
    if socket_path.exists() {
        fs::remove_file(&socket_path)?;
    }
    let listener = UnixListener::bind(&socket_path)
        .with_context(|| format!("failed to bind control socket {}", socket_path.display()))?;
    listener.set_nonblocking(true)?;
    Ok(thread::spawn(move || {
        while !stop.load(Ordering::Acquire) {
            match listener.accept() {
                Ok((stream, _addr)) => {
                    handle_control_stream(stream, &audit_path, &control_tx);
                }
                Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(std::time::Duration::from_millis(50));
                }
                Err(_) => thread::sleep(std::time::Duration::from_millis(50)),
            }
        }
        let _ = fs::remove_file(&socket_path);
    }))
}

#[cfg(unix)]
fn handle_control_stream(
    mut stream: std::os::unix::net::UnixStream,
    audit_path: &Path,
    control_tx: &mpsc::Sender<ControlEnvelope>,
) {
    let mut line = String::new();
    let read_result = {
        let mut reader = BufReader::new(&mut stream);
        reader.read_line(&mut line)
    };
    let response = match read_result {
        Ok(0) => ControlResponse::error(
            &ControlRequest::new(super::control::ControlOp::Health),
            "empty control request",
        ),
        Ok(_) => match serde_json::from_str::<ControlRequest>(line.trim()) {
            Ok(request) => {
                append_audit(audit_path, &request);
                dispatch_control(request, control_tx)
            }
            Err(error) => ControlResponse::error(
                &ControlRequest::new(super::control::ControlOp::Health),
                format!("invalid control request: {error}"),
            ),
        },
        Err(error) => ControlResponse::error(
            &ControlRequest::new(super::control::ControlOp::Health),
            format!("failed to read control request: {error}"),
        ),
    };
    let _ = writeln!(
        stream,
        "{}",
        serde_json::to_string(&response).unwrap_or_else(|_| "{\"ok\":false}".to_string())
    );
}

fn dispatch_control(
    request: ControlRequest,
    control_tx: &mpsc::Sender<ControlEnvelope>,
) -> ControlResponse {
    let timeout = request.response_timeout();
    let (reply_tx, reply_rx) = mpsc::channel();
    let fallback_request = request.clone();
    let envelope = ControlEnvelope { request, reply_tx };
    if control_tx.send(envelope).is_err() {
        return ControlResponse::error(&fallback_request, "listener control plane is closed");
    }
    match reply_rx.recv_timeout(timeout) {
        Ok(response) => response,
        Err(mpsc::RecvTimeoutError::Timeout) => {
            ControlResponse::error(&fallback_request, "control response timed out")
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            ControlResponse::error(&fallback_request, "control response channel closed")
        }
    }
}

fn append_audit(path: &Path, request: &ControlRequest) {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) else {
        return;
    };
    let unix_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    let record = json!({
        "unix_ms": unix_ms,
        "op": request.op,
        "selector": request.selector,
        "sensitive": request.sensitive,
    });
    let _ = writeln!(file, "{record}");
}

#[cfg(not(unix))]
pub fn spawn_control_server(
    _socket_path: PathBuf,
    _audit_path: PathBuf,
    _control_tx: mpsc::Sender<ControlEnvelope>,
    _stop: Arc<AtomicBool>,
) -> Result<thread::JoinHandle<()>> {
    bail!("shell-listener control socket is supported on Unix platforms only")
}

#[cfg(unix)]
pub fn send_control_request(
    socket_path: &Path,
    request: &ControlRequest,
) -> Result<ControlResponse> {
    use std::net::Shutdown;
    use std::os::unix::net::UnixStream;
    let mut stream = UnixStream::connect(socket_path)
        .with_context(|| format!("failed to connect to {}", socket_path.display()))?;
    writeln!(stream, "{}", serde_json::to_string(request)?)?;
    stream.shutdown(Shutdown::Write)?;
    let mut reader = BufReader::new(stream);
    let mut response = String::new();
    reader.read_line(&mut response)?;
    if response.trim().is_empty() {
        bail!("empty control response");
    }
    serde_json::from_str(response.trim()).context("failed to parse control response")
}

#[cfg(not(unix))]
pub fn send_control_request(
    _socket_path: &Path,
    _request: &ControlRequest,
) -> Result<ControlResponse> {
    bail!("shell-listener control socket is supported on Unix platforms only")
}
