//! Shared subprocess helpers.
//!
//! Every tool that shells out to an external binary (`git`, `npx`, `curl`,
//! `jq`, ...) routes through [`run_with_timeout`] so a hung or runaway child
//! process can never block a tool call indefinitely.

use crate::{Error, Result};
use std::io::{Read, Write};
use std::process::{Command, Output, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

/// Run `command` to completion, killing it if it runs longer than `timeout`.
///
/// `stdin_data`, when present, is written to the child's stdin and the pipe is
/// then closed (EOF). Stdout and stderr are drained on dedicated threads to
/// avoid the classic pipe-buffer deadlock on large output.
///
/// Returns `Error::Tool` if the deadline is exceeded; the child is killed and
/// reaped before returning.
pub fn run_with_timeout(
    mut command: Command,
    timeout: Duration,
    stdin_data: Option<&[u8]>,
) -> Result<Output> {
    command.stdin(if stdin_data.is_some() {
        Stdio::piped()
    } else {
        Stdio::null()
    });
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    let mut child = command.spawn()?;

    // A child that exits early closes its stdin; a broken-pipe write is
    // expected in that case and must not fail the whole call. Taking `stdin`
    // and letting it drop at the end of this block signals EOF to the child.
    if let Some(data) = stdin_data
        && let Some(mut stdin) = child.stdin.take()
    {
        let _ = stdin.write_all(data);
    }

    let mut stdout_pipe = child.stdout.take();
    let mut stderr_pipe = child.stderr.take();
    let (tx_out, rx_out) = mpsc::channel();
    let (tx_err, rx_err) = mpsc::channel();

    let out_handle = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(pipe) = stdout_pipe.as_mut() {
            let _ = pipe.read_to_end(&mut buf);
        }
        let _ = tx_out.send(buf);
    });
    let err_handle = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(pipe) = stderr_pipe.as_mut() {
            let _ = pipe.read_to_end(&mut buf);
        }
        let _ = tx_err.send(buf);
    });

    let start = Instant::now();
    let poll = Duration::from_millis(20);
    let status = loop {
        match child.try_wait()? {
            Some(status) => break status,
            None => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(Error::Tool(format!(
                        "command timed out after {}s",
                        timeout.as_secs()
                    )));
                }
                thread::sleep(poll);
            }
        }
    };

    let stdout = rx_out.recv().unwrap_or_default();
    let stderr = rx_err.recv().unwrap_or_default();
    let _ = out_handle.join();
    let _ = err_handle.join();

    Ok(Output {
        status,
        stdout,
        stderr,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn captures_stdout_for_a_fast_command() {
        let mut cmd = Command::new("echo");
        cmd.arg("hello");
        let output = run_with_timeout(cmd, Duration::from_secs(5), None).unwrap();
        assert!(output.status.success());
        assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), "hello");
    }

    #[test]
    fn forwards_stdin_to_the_child() {
        // `cat` echoes stdin to stdout on every supported CI image.
        let cmd = Command::new("cat");
        let output = run_with_timeout(cmd, Duration::from_secs(5), Some(b"piped")).unwrap();
        assert_eq!(String::from_utf8_lossy(&output.stdout), "piped");
    }

    #[test]
    fn kills_a_command_that_exceeds_the_timeout() {
        let mut cmd = Command::new("sleep");
        cmd.arg("10");
        let result = run_with_timeout(cmd, Duration::from_millis(100), None);
        assert!(result.is_err());
    }
}
