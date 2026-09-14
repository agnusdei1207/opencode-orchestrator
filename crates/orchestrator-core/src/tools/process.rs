//! Shared subprocess helpers.
//!
//! Every tool that shells out to an external binary (`git`, `npx`, `curl`,
//! `jq`, ...) routes through [`run_with_timeout`] so a hung or runaway child
//! process can never block a tool call indefinitely.

use crate::{Error, Result};
use std::io::{Read, Write};
use std::process::{Child, Command, Output, Stdio};
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
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }

    let start = Instant::now();
    let mut child = command.spawn()?;

    // A child that exits early closes its stdin; a broken-pipe write is
    // expected in that case and must not fail the whole call. Taking `stdin`
    // and letting it drop at the end of this block signals EOF to the child.
    let input_handle = stdin_data.and_then(|data| {
        let mut stdin = child.stdin.take()?;
        let data = data.to_vec();
        let (sender, receiver) = mpsc::channel();
        let handle = thread::spawn(move || {
            let _ = stdin.write_all(&data);
            let _ = sender.send(());
        });
        Some((handle, receiver))
    });

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

    let poll = Duration::from_millis(20);
    let status = loop {
        match child.try_wait()? {
            Some(status) => break status,
            None => {
                if start.elapsed() >= timeout {
                    stop_child(&mut child);
                    return Err(timeout_error(timeout));
                }
                thread::sleep(poll);
            }
        }
    };

    let output = rx_out
        .recv_timeout(timeout.saturating_sub(start.elapsed()))
        .and_then(|stdout| {
            rx_err
                .recv_timeout(timeout.saturating_sub(start.elapsed()))
                .map(|stderr| (stdout, stderr))
        });
    let (stdout, stderr) = match output {
        Ok(output) => output,
        Err(_) => {
            stop_child(&mut child);
            return Err(timeout_error(timeout));
        }
    };
    let _ = out_handle.join();
    let _ = err_handle.join();
    if let Some((handle, receiver)) = input_handle {
        if receiver
            .recv_timeout(timeout.saturating_sub(start.elapsed()))
            .is_err()
        {
            stop_child(&mut child);
            return Err(timeout_error(timeout));
        }
        let _ = handle.join();
    }

    Ok(Output {
        status,
        stdout,
        stderr,
    })
}

fn stop_child(child: &mut Child) {
    #[cfg(unix)]
    {
        // The child owns its process group, including descendants retaining pipes.
        let _ = Command::new("/bin/kill")
            .args(["-KILL", "--", &format!("-{}", child.id())])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    let _ = child.kill();
    let _ = child.wait();
}

fn timeout_error(timeout: Duration) -> Error {
    Error::Tool(format!("command timed out after {}ms", timeout.as_millis()))
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

    #[test]
    fn deadline_also_bounds_inherited_output_pipes_after_parent_exit() {
        let mut cmd = Command::new("sh");
        cmd.args(["-c", "sleep 2 & printf ready"]);
        let start = Instant::now();
        let result = run_with_timeout(cmd, Duration::from_millis(100), None);
        assert!(start.elapsed() < Duration::from_secs(1));
        assert!(result.is_err());
    }

    #[test]
    fn deadline_also_bounds_a_child_that_does_not_read_stdin() {
        let mut cmd = Command::new("sleep");
        cmd.arg("2");
        let input = vec![b'x'; 1024 * 1024];
        let start = Instant::now();
        let result = run_with_timeout(cmd, Duration::from_millis(100), Some(&input));
        assert!(start.elapsed() < Duration::from_secs(1));
        assert!(result.is_err());
    }

    #[test]
    fn deadline_bounds_inherited_stdin_even_when_output_pipes_are_closed() {
        let mut cmd = Command::new("sh");
        cmd.args(["-c", "exec 3<&0; sleep 2 <&3 >/dev/null 2>&1 &"]);
        let input = vec![b'x'; 1024 * 1024];
        let start = Instant::now();
        let result = run_with_timeout(cmd, Duration::from_millis(100), Some(&input));
        assert!(start.elapsed() < Duration::from_secs(1));
        assert!(result.is_err());
    }
}
