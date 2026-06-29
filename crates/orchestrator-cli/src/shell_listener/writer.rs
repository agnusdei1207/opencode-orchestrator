use std::io::Write;
use std::net::{Shutdown, TcpStream};
use std::sync::mpsc;
use std::thread;

use super::session::SessionWrite;

pub fn spawn_tcp_writer(
    id: u64,
    mut stream: TcpStream,
    rx: mpsc::Receiver<SessionWrite>,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        for message in rx {
            match message {
                SessionWrite::Bytes(bytes) => {
                    if stream.write_all(&bytes).is_err() {
                        break;
                    }
                }
                SessionWrite::Close => break,
            }
        }
        let _ = stream.shutdown(Shutdown::Both);
        let _ = id;
    })
}
