use std::fs::OpenOptions;
use std::io::{self, Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;
use std::time::Duration;

use super::fd_budget::ActiveSessionGuard;
use super::registry::ListenerEvent;
use super::session::redact_sensitive_text;
use super::terminal::sanitize_terminal_text;

const READ_BUFFER_SIZE: usize = 8192;
const READ_TICK: Duration = Duration::from_millis(50);

pub fn spawn_tcp_reader(
    id: u64,
    mut stream: TcpStream,
    log_path: PathBuf,
    tx: mpsc::Sender<ListenerEvent>,
    revoked: Arc<AtomicBool>,
    redactions: Arc<Mutex<Vec<String>>>,
    active_guard: ActiveSessionGuard,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let _active_guard = active_guard;
        let mut log = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .ok();
        let mut buffer = [0_u8; READ_BUFFER_SIZE];
        loop {
            if revoked.load(Ordering::Acquire) {
                let _ = tx.send(ListenerEvent::Disconnected {
                    id,
                    reason: "session revoked".to_string(),
                });
                break;
            }
            match stream.read(&mut buffer) {
                Ok(0) => {
                    let _ = tx.send(ListenerEvent::Disconnected {
                        id,
                        reason: "session closed".to_string(),
                    });
                    break;
                }
                Ok(size) => {
                    let bytes = &buffer[..size];
                    if let Some(file) = log.as_mut() {
                        let redacted =
                            redact_sensitive_text(&String::from_utf8_lossy(bytes), &redactions);
                        let _ = file.write_all(redacted.as_bytes());
                    }
                    let text = sanitize_terminal_text(bytes);
                    let text = redact_sensitive_text(&text, &redactions);
                    let _ = tx.send(ListenerEvent::Output {
                        id,
                        bytes: size,
                        text,
                    });
                }
                Err(err) if err.kind() == io::ErrorKind::WouldBlock => thread::sleep(READ_TICK),
                Err(err) if err.kind() == io::ErrorKind::Interrupted => continue,
                Err(err) => {
                    let _ = tx.send(ListenerEvent::Disconnected {
                        id,
                        reason: format!("read failed: {err}"),
                    });
                    break;
                }
            }
        }
    })
}
