//! Shared subprocess helpers.
//!
//! Every tool that shells out to an external binary (`git`, `npx`, `curl`,
//! `jq`, ...) routes through [`run_with_timeout`] so a hung or runaway child
//! process can never block a tool call indefinitely.

use crate::{Error, Result};
use std::io::{self, Read, Write};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::thread::{self, JoinHandle};
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
) -> Result<CapturedOutput> {
    configure_stdio(&mut command, stdin_data.is_some());

    let deadline = Deadline {
        start: Instant::now(),
        timeout,
    };
    let mut child = command.spawn()?;

    let input_handle = spawn_stdin_writer(&mut child, stdin_data);
    let (out_handle, rx_out) = spawn_pipe_reader(child.stdout.take());
    let (err_handle, rx_err) = spawn_pipe_reader(child.stderr.take());

    let status = wait_for_exit(&mut child, deadline)?;

    let output = rx_out
        .recv_timeout(deadline.remaining())
        .and_then(|stdout| {
            rx_err
                .recv_timeout(deadline.remaining())
                .map(|stderr| (stdout, stderr))
        });
    let Ok((stdout, stderr)) = output else {
        stop_child(&mut child);
        return Err(timeout_error(timeout));
    };
    let _ = out_handle.join();
    let _ = err_handle.join();
    if let Some(input) = input_handle {
        finish_stdin(input, &mut child, deadline)?;
    }

    Ok(CapturedOutput {
        status,
        stdout: stdout.bytes,
        stderr: stderr.bytes,
        stdout_truncated: stdout.truncated,
        stderr_truncated: stderr.truncated,
    })
}

/// Most bytes kept from each of a child's stdout and stderr.
pub const MAX_CAPTURED_BYTES: u64 = 16 * 1024 * 1024;

/// Exit status and captured output of a finished child process.
#[derive(Debug)]
pub struct CapturedOutput {
    pub status: ExitStatus,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    /// The child wrote more than [`MAX_CAPTURED_BYTES`] to stdout.
    pub stdout_truncated: bool,
    /// The child wrote more than [`MAX_CAPTURED_BYTES`] to stderr.
    pub stderr_truncated: bool,
}

/// Poll interval while waiting for the child to exit.
const POLL_INTERVAL: Duration = Duration::from_millis(20);

/// Start instant and budget shared by every wait of one invocation.
#[derive(Clone, Copy)]
struct Deadline {
    start: Instant,
    timeout: Duration,
}

impl Deadline {
    fn expired(self) -> bool {
        self.start.elapsed() >= self.timeout
    }

    fn remaining(self) -> Duration {
        self.timeout.saturating_sub(self.start.elapsed())
    }
}

/// Thread writing stdin plus the channel it signals once the write finished.
type StdinWriter = (JoinHandle<()>, Receiver<()>);

fn configure_stdio(command: &mut Command, has_stdin: bool) {
    command.stdin(if has_stdin {
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
}

/// A child that exits early closes its stdin; a broken-pipe write is
/// expected in that case and must not fail the whole call. Taking `stdin`
/// and letting it drop at the end of the writer thread signals EOF to the child.
fn spawn_stdin_writer(child: &mut Child, stdin_data: Option<&[u8]>) -> Option<StdinWriter> {
    stdin_data.and_then(|data| {
        let mut stdin = child.stdin.take()?;
        let data = data.to_vec();
        let (sender, receiver) = mpsc::channel();
        let handle = thread::spawn(move || {
            let _ = stdin.write_all(&data);
            let _ = sender.send(());
        });
        Some((handle, receiver))
    })
}

/// Bytes kept from one output stream.
#[derive(Default)]
struct Captured {
    bytes: Vec<u8>,
    truncated: bool,
}

/// Drain `pipe` on its own thread so a full pipe buffer never blocks the child.
fn spawn_pipe_reader<R>(pipe: Option<R>) -> (JoinHandle<()>, Receiver<Captured>)
where
    R: Read + Send + 'static,
{
    let (sender, receiver) = mpsc::channel();
    let handle = thread::spawn(move || {
        let captured = pipe.map(read_capped).unwrap_or_default();
        let _ = sender.send(captured);
    });
    (handle, receiver)
}

/// Keep the first [`MAX_CAPTURED_BYTES`]; anything after that is still read,
/// so the child can finish, but discarded.
fn read_capped<R: Read>(mut pipe: R) -> Captured {
    let mut bytes = Vec::new();
    let _ = pipe
        .by_ref()
        .take(MAX_CAPTURED_BYTES)
        .read_to_end(&mut bytes);
    let discarded = io::copy(&mut pipe, &mut io::sink()).unwrap_or(0);
    Captured {
        bytes,
        truncated: discarded > 0,
    }
}

fn wait_for_exit(child: &mut Child, deadline: Deadline) -> Result<ExitStatus> {
    loop {
        if let Some(status) = child.try_wait()? {
            return Ok(status);
        }
        if deadline.expired() {
            stop_child(child);
            return Err(timeout_error(deadline.timeout));
        }
        thread::sleep(POLL_INTERVAL);
    }
}

fn finish_stdin(input: StdinWriter, child: &mut Child, deadline: Deadline) -> Result<()> {
    let (handle, receiver) = input;
    if receiver.recv_timeout(deadline.remaining()).is_err() {
        stop_child(child);
        return Err(timeout_error(deadline.timeout));
    }
    let _ = handle.join();
    Ok(())
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

// These tests drive `echo`, `cat`, `sleep`, and `sh`, which are not
// executables on Windows.
#[cfg(all(test, unix))]
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
    fn output_within_the_capture_limit_is_not_flagged() {
        let mut cmd = Command::new("echo");
        cmd.arg("hello");
        let output = run_with_timeout(cmd, Duration::from_secs(5), None).unwrap();
        assert!(!output.stdout_truncated);
        assert!(!output.stderr_truncated);
    }

    #[test]
    fn output_beyond_the_capture_limit_is_discarded_and_flagged() {
        let mut cmd = Command::new("sh");
        let script = format!("head -c {} /dev/zero", MAX_CAPTURED_BYTES + 1);
        cmd.args(["-c", &script]);

        let output = run_with_timeout(cmd, Duration::from_secs(20), None).unwrap();

        assert!(output.status.success());
        assert_eq!(output.stdout.len() as u64, MAX_CAPTURED_BYTES);
        assert!(output.stdout_truncated);
        assert!(!output.stderr_truncated);
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
