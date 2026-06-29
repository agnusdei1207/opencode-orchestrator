use anyhow::{Context, Result};
use std::fs;
use std::io::Write;
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;
use std::time::Duration;

use super::fd_budget::FdAccounting;
use super::reader::spawn_tcp_reader;
use super::registry::ListenerEvent;
use super::session::SessionState;
use super::writer::spawn_tcp_writer;

const ACCEPT_TICK: Duration = Duration::from_millis(50);

pub fn spawn_accept_loop(
    listener: TcpListener,
    log_dir: PathBuf,
    tx: mpsc::Sender<ListenerEvent>,
    stop: Arc<AtomicBool>,
    next_id: Arc<AtomicU64>,
    accounting: FdAccounting,
) -> thread::JoinHandle<()> {
    thread::spawn(move || accept_loop(listener, log_dir, tx, stop, next_id, accounting))
}

fn accept_loop(
    listener: TcpListener,
    log_dir: PathBuf,
    tx: mpsc::Sender<ListenerEvent>,
    stop: Arc<AtomicBool>,
    next_id: Arc<AtomicU64>,
    accounting: FdAccounting,
) {
    while !stop.load(Ordering::Acquire) {
        match listener.accept() {
            Ok((stream, peer)) => {
                if let Err(error) =
                    register_stream(stream, peer, &log_dir, &tx, &next_id, &accounting)
                {
                    let _ = tx.send(ListenerEvent::Error(format!(
                        "session setup failed: {error}"
                    )));
                }
            }
            Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => thread::sleep(ACCEPT_TICK),
            Err(err) => {
                let _ = tx.send(ListenerEvent::Error(format!("accept failed: {err}")));
                thread::sleep(ACCEPT_TICK);
            }
        }
    }
}

fn register_stream(
    mut stream: TcpStream,
    peer: SocketAddr,
    log_dir: &Path,
    tx: &mpsc::Sender<ListenerEvent>,
    next_id: &AtomicU64,
    accounting: &FdAccounting,
) -> Result<()> {
    let active = accounting.active.get();
    if !accounting.budget.admits(active) {
        let _ = writeln!(
            stream,
            "OpenCode Orchestrator shell listener refused session: fd budget exhausted"
        );
        return Ok(());
    }
    let guard = accounting.active.enter();
    stream.set_nonblocking(true)?;
    fs::create_dir_all(log_dir)?;

    let id = next_id.fetch_add(1, Ordering::AcqRel);
    let writer_stream = stream
        .try_clone()
        .context("failed to clone writer stream")?;
    let close_stream = stream.try_clone().context("failed to clone close stream")?;
    let log_path = log_path_for(log_dir, id, peer);
    let (write_tx, write_rx) = mpsc::channel();
    let revoked = Arc::new(AtomicBool::new(false));
    let redactions = Arc::new(Mutex::new(Vec::new()));

    let session = SessionState::new(
        id,
        peer,
        log_path.clone(),
        write_tx,
        revoked.clone(),
        redactions.clone(),
        close_stream,
    );

    spawn_tcp_writer(id, writer_stream, write_rx);
    spawn_tcp_reader(id, stream, log_path, tx.clone(), revoked, redactions, guard);
    tx.send(ListenerEvent::Connected(session))
        .context("failed to publish connected session")?;
    if accounting.budget.is_under_pressure(accounting.active.get()) {
        let report = accounting.report();
        let _ = tx.send(ListenerEvent::Warning(format!(
            "fd pressure {}% ({}/{})",
            report.pressure_pct, report.active_sessions, report.max_sessions
        )));
    }
    Ok(())
}

fn log_path_for(log_dir: &Path, id: u64, peer: SocketAddr) -> PathBuf {
    let peer_name = peer.to_string().replace([':', '.'], "_");
    log_dir.join(format!("session_{id}_{peer_name}.raw.log"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn log_path_sanitizes_peer_name() {
        let peer: SocketAddr = "127.0.0.1:4444".parse().unwrap();
        let path = log_path_for(Path::new("logs"), 3, peer);
        assert_eq!(path, PathBuf::from("logs/session_3_127_0_0_1_4444.raw.log"));
    }
}
