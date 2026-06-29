use anyhow::{Context, Result, bail};
use std::fs;
use std::io::{self, BufRead, Write};
use std::net::{IpAddr, SocketAddr, TcpListener};
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc;
use std::time::Duration;

mod accept;
mod control;
mod control_socket;
mod fd_budget;
mod pending;
mod prompt_detect;
mod reader;
mod registry;
mod session;
mod terminal;
mod writer;

use accept::spawn_accept_loop;
use control::{ControlOp, ControlRequest, print_control_response};
use control_socket::{ControlEnvelope, send_control_request, spawn_control_server};
use fd_budget::{ActiveSessionCounter, FdAccounting, default_budget};
use registry::{CommandOutcome, SessionRegistry};

const DEFAULT_BIND: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 4444;
const DEFAULT_LOG_DIR: &str = ".opencode-orchestrator/shell-listener";
const DEFAULT_CONTROL_SOCKET: &str = "control.sock";
const TUI_TICK: Duration = Duration::from_millis(100);

#[derive(Debug, Clone)]
struct ListenerConfig {
    bind: IpAddr,
    port: u16,
    allow_remote: bool,
    log_dir: PathBuf,
    control_socket: Option<PathBuf>,
    no_tui: bool,
    no_control: bool,
    show_help: bool,
}

#[derive(Debug)]
struct ShellSessionArgs {
    socket: PathBuf,
    request: ControlRequest,
    json: bool,
}

pub fn run(args: &[String]) -> Result<()> {
    let config = ListenerConfig::parse(args)?;
    if config.show_help {
        print_shell_help();
        return Ok(());
    }

    config.validate()?;
    fs::create_dir_all(&config.log_dir)?;
    let bind_addr = config.socket_addr();
    let listener = TcpListener::bind(bind_addr)
        .with_context(|| format!("failed to bind shell listener on {bind_addr}"))?;
    listener.set_nonblocking(true)?;
    let local_addr = listener.local_addr()?;
    print_startup(&config, local_addr);

    let stop = Arc::new(AtomicBool::new(false));
    let next_id = Arc::new(AtomicU64::new(1));
    let (event_tx, event_rx) = mpsc::channel();
    let (control_tx, control_rx) = mpsc::channel::<ControlEnvelope>();
    let accounting = FdAccounting::new(
        default_budget(fd_budget::current_nofile_soft_limit()),
        ActiveSessionCounter::new(),
    );

    let accept_handle = spawn_accept_loop(
        listener,
        config.log_dir.clone(),
        event_tx.clone(),
        stop.clone(),
        next_id,
        accounting.clone(),
    );
    let control_handle = if config.no_control {
        None
    } else {
        Some(spawn_control_server(
            config.resolved_control_socket(),
            config.log_dir.join("audit.jsonl"),
            control_tx,
            stop.clone(),
        )?)
    };

    let result = if config.no_tui {
        run_event_log(local_addr, event_rx, control_rx, accounting)
    } else {
        run_operator_loop(local_addr, event_rx, control_rx, stop.clone(), accounting)
    };

    stop.store(true, Ordering::Release);
    let _ = accept_handle.join();
    if let Some(handle) = control_handle {
        let _ = handle.join();
    }
    result
}

pub fn run_session_command(args: &[String]) -> Result<()> {
    let parsed = ShellSessionArgs::parse(args)?;
    if parsed.request.op == ControlOp::Help {
        print_shell_session_help();
        return Ok(());
    }
    let response = send_control_request(&parsed.socket, &parsed.request)?;
    if parsed.json {
        println!("{}", serde_json::to_string_pretty(&response)?);
    } else {
        print_control_response(&response);
    }
    if response.ok {
        Ok(())
    } else {
        bail!(
            "{}",
            response
                .error
                .as_deref()
                .unwrap_or("shell-session command failed")
        )
    }
}

impl Default for ListenerConfig {
    fn default() -> Self {
        Self {
            bind: DEFAULT_BIND.parse().expect("valid default bind"),
            port: DEFAULT_PORT,
            allow_remote: false,
            log_dir: PathBuf::from(DEFAULT_LOG_DIR),
            control_socket: None,
            no_tui: false,
            no_control: false,
            show_help: false,
        }
    }
}

impl ListenerConfig {
    fn parse(args: &[String]) -> Result<Self> {
        let mut config = Self::default();
        let mut index = 0;
        while index < args.len() {
            index = parse_listener_flag(args, index, &mut config)?;
        }
        Ok(config)
    }

    fn validate(&self) -> Result<()> {
        if !self.bind.is_loopback() && !self.allow_remote {
            bail!("refusing non-loopback bind without --allow-remote");
        }
        Ok(())
    }

    fn socket_addr(&self) -> SocketAddr {
        SocketAddr::new(self.bind, self.port)
    }

    fn resolved_control_socket(&self) -> PathBuf {
        self.control_socket
            .clone()
            .unwrap_or_else(|| self.log_dir.join(DEFAULT_CONTROL_SOCKET))
    }
}

impl ShellSessionArgs {
    fn parse(args: &[String]) -> Result<Self> {
        if args.is_empty() || matches!(args[0].as_str(), "--help" | "-h" | "help") {
            return Ok(Self {
                socket: default_control_socket(),
                request: ControlRequest::new(ControlOp::Help),
                json: false,
            });
        }

        let mut socket = default_control_socket();
        let mut json = false;
        let mut filtered = Vec::new();
        let mut index = 0;
        while index < args.len() {
            match args[index].as_str() {
                "--socket" => {
                    socket = PathBuf::from(require_value(args, index, "--socket")?);
                    index += 2;
                }
                "--json" => {
                    json = true;
                    index += 1;
                }
                value => {
                    filtered.push(value.to_string());
                    index += 1;
                }
            }
        }

        let request = parse_shell_session_request(&filtered)?;
        Ok(Self {
            socket,
            request,
            json,
        })
    }
}

fn parse_listener_flag(
    args: &[String],
    index: usize,
    config: &mut ListenerConfig,
) -> Result<usize> {
    match args[index].as_str() {
        "--bind" => {
            config.bind = require_value(args, index, "--bind")?.parse()?;
            Ok(index + 2)
        }
        "--port" => {
            config.port = require_value(args, index, "--port")?.parse()?;
            Ok(index + 2)
        }
        "--log-dir" => {
            config.log_dir = PathBuf::from(require_value(args, index, "--log-dir")?);
            Ok(index + 2)
        }
        "--control-socket" => {
            config.control_socket = Some(PathBuf::from(require_value(
                args,
                index,
                "--control-socket",
            )?));
            Ok(index + 2)
        }
        "--allow-remote" => {
            config.allow_remote = true;
            Ok(index + 1)
        }
        "--no-tui" => {
            config.no_tui = true;
            Ok(index + 1)
        }
        "--no-control" => {
            config.no_control = true;
            Ok(index + 1)
        }
        "--help" | "-h" => {
            config.show_help = true;
            Ok(index + 1)
        }
        flag => bail!("unknown shell-listener flag: {flag}"),
    }
}

fn parse_shell_session_request(args: &[String]) -> Result<ControlRequest> {
    let command = args.first().map(String::as_str).unwrap_or("help");
    match command {
        "health" => Ok(ControlRequest::new(ControlOp::Health)),
        "list" | "sessions" => Ok(ControlRequest::new(ControlOp::List)),
        "fdstat" => Ok(ControlRequest::new(ControlOp::Fdstat)),
        "lifecycle" => Ok(ControlRequest::new(ControlOp::Lifecycle)),
        "info" => Ok(ControlRequest::new(ControlOp::Info).selector(required_arg(
            args,
            1,
            "info <session>",
        )?)),
        "tail" => {
            let mut request = ControlRequest::new(ControlOp::Tail).selector(required_arg(
                args,
                1,
                "tail <session>",
            )?);
            if let Some(bytes) = parse_flag_value(args, "--bytes")? {
                request.limit_bytes = Some(bytes.parse()?);
            }
            Ok(request)
        }
        "send" => Ok(ControlRequest::new(ControlOp::Send)
            .selector(required_arg(args, 1, "send <session> <text>")?)
            .text(join_from(args, 2, "send <session> <text>")?)),
        "raw" => Ok(ControlRequest::new(ControlOp::Raw)
            .selector(required_arg(args, 1, "raw <session> <text>")?)
            .text(join_from(args, 2, "raw <session> <text>")?)),
        "run" => {
            let selector = required_arg(args, 1, "run <session> [--timeout-ms n] <command>")?;
            let mut command_parts = Vec::new();
            let mut timeout_ms = None;
            let mut index = 2;
            while index < args.len() {
                if args[index] == "--timeout-ms" {
                    timeout_ms = Some(required_value(args, index, "--timeout-ms")?.parse()?);
                    index += 2;
                } else {
                    command_parts.push(args[index].clone());
                    index += 1;
                }
            }
            if command_parts.is_empty() {
                bail!("run <session> requires a command");
            }
            let mut request = ControlRequest::new(ControlOp::Run)
                .selector(selector)
                .text(command_parts.join(" "));
            request.timeout_ms = timeout_ms;
            Ok(request)
        }
        "close" => {
            let mut request = ControlRequest::new(ControlOp::Close).selector(required_arg(
                args,
                1,
                "close <session>",
            )?);
            if args.len() > 2 {
                request.reason = Some(args[2..].join(" "));
            }
            Ok(request)
        }
        "revoke" => {
            let mut request = ControlRequest::new(ControlOp::Revoke).selector(required_arg(
                args,
                1,
                "revoke <session>",
            )?);
            if args.len() > 2 {
                request.reason = Some(args[2..].join(" "));
            }
            Ok(request)
        }
        "help" | "--help" | "-h" => Ok(ControlRequest::new(ControlOp::Help)),
        other => bail!("unknown shell-session command: {other}"),
    }
}

fn run_event_log(
    local_addr: SocketAddr,
    event_rx: mpsc::Receiver<registry::ListenerEvent>,
    control_rx: mpsc::Receiver<ControlEnvelope>,
    accounting: FdAccounting,
) -> Result<()> {
    println!("OpenCode Orchestrator shell listener");
    println!("listening: {local_addr}");
    println!("event-log mode is non-interactive");
    let mut registry = SessionRegistry::new(accounting);
    loop {
        match event_rx.recv_timeout(TUI_TICK) {
            Ok(event) => {
                let message = registry.apply_event(event);
                if !message.is_empty() {
                    println!("{message}");
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
        while let Ok(envelope) = control_rx.try_recv() {
            registry.handle_control_envelope(envelope);
        }
        registry.expire_pending_runs();
    }
    Ok(())
}

fn run_operator_loop(
    local_addr: SocketAddr,
    event_rx: mpsc::Receiver<registry::ListenerEvent>,
    control_rx: mpsc::Receiver<ControlEnvelope>,
    stop: Arc<AtomicBool>,
    accounting: FdAccounting,
) -> Result<()> {
    let mut registry = SessionRegistry::new(accounting);
    let stdin = io::stdin();
    println!("OpenCode Orchestrator shell listener");
    println!("listening: {local_addr}");
    println!("type 'help' for TUI commands");
    print_prompt();

    for line in stdin.lock().lines() {
        while let Ok(event) = event_rx.try_recv() {
            let message = registry.apply_event(event);
            if !message.is_empty() {
                println!("\r{message}");
            }
        }
        while let Ok(envelope) = control_rx.try_recv() {
            registry.handle_control_envelope(envelope);
        }
        registry.expire_pending_runs();

        let command = line?;
        match registry.execute_operator_command(command.trim())? {
            CommandOutcome::Continue(message) => {
                if !message.is_empty() {
                    println!("{message}");
                }
            }
            CommandOutcome::Quit => break,
        }
        print_prompt();
    }

    stop.store(true, Ordering::Release);
    Ok(())
}

fn print_startup(config: &ListenerConfig, local_addr: SocketAddr) {
    println!("OpenCode Orchestrator shell listener");
    println!("listening: {local_addr}");
    println!("logs: {}", config.log_dir.display());
    if !config.no_control {
        println!("control: {}", config.resolved_control_socket().display());
    }
}

fn print_shell_help() {
    println!("Usage: orchestrator shell-listener [options]");
    println!();
    println!("Options:");
    println!("  --bind <ip>             Bind address (default: {DEFAULT_BIND})");
    println!("  --port <port>           Bind port (default: {DEFAULT_PORT})");
    println!("  --allow-remote          Permit non-loopback bind addresses");
    println!("  --log-dir <path>        Raw stream log directory");
    println!("  --control-socket <path> Local JSONL control socket");
    println!("  --no-control            Disable local control socket");
    println!("  --no-tui                Print connection events without operator input");
    println!();
    println!(
        "TUI commands: sessions, use <id>, detach, send <text>, raw <text>, run <cmd>, tail [id], fdstat, lifecycle, pty, close [id], revoke [id], quit"
    );
}

fn print_shell_session_help() {
    println!("Usage: orchestrator shell-session [--socket <path>] [--json] <command>");
    println!();
    println!("Commands:");
    println!("  health");
    println!("  list");
    println!("  info <session>");
    println!("  tail <session> [--bytes n]");
    println!("  send <session> <text>");
    println!("  raw <session> <text>");
    println!("  run <session> [--timeout-ms n] <command>");
    println!("  close <session> [reason]");
    println!("  revoke <session> [reason]");
    println!("  fdstat");
    println!("  lifecycle");
}

fn print_prompt() {
    print!("oco-shell> ");
    let _ = io::stdout().flush();
}

fn default_control_socket() -> PathBuf {
    PathBuf::from(DEFAULT_LOG_DIR).join(DEFAULT_CONTROL_SOCKET)
}

fn require_value<'a>(args: &'a [String], index: usize, flag: &str) -> Result<&'a str> {
    args.get(index + 1)
        .map(String::as_str)
        .filter(|value| !value.starts_with("--"))
        .with_context(|| format!("{flag} requires a value"))
}

fn required_value<'a>(args: &'a [String], index: usize, flag: &str) -> Result<&'a str> {
    args.get(index + 1)
        .map(String::as_str)
        .with_context(|| format!("{flag} requires a value"))
}

fn required_arg(args: &[String], index: usize, usage: &str) -> Result<String> {
    args.get(index)
        .filter(|value| !value.trim().is_empty())
        .cloned()
        .with_context(|| format!("usage: {usage}"))
}

fn join_from(args: &[String], index: usize, usage: &str) -> Result<String> {
    if args.len() <= index {
        bail!("usage: {usage}");
    }
    Ok(args[index..].join(" "))
}

fn parse_flag_value<'a>(args: &'a [String], flag: &str) -> Result<Option<&'a str>> {
    let Some(index) = args.iter().position(|value| value == flag) else {
        return Ok(None);
    };
    Ok(Some(required_value(args, index, flag)?))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn listener_default_bind_is_loopback() {
        let config = ListenerConfig::parse(&[]).unwrap();
        assert_eq!(config.bind.to_string(), DEFAULT_BIND);
        assert!(config.validate().is_ok());
    }

    #[test]
    fn listener_remote_bind_requires_explicit_flag() {
        let config = ListenerConfig::parse(&strings(&["--bind", "0.0.0.0"])).unwrap();
        assert!(config.validate().is_err());
        let config =
            ListenerConfig::parse(&strings(&["--bind", "0.0.0.0", "--allow-remote"])).unwrap();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn shell_session_run_request_parses_timeout_and_command() {
        let parsed = ShellSessionArgs::parse(&strings(&[
            "--socket",
            "/tmp/oco.sock",
            "--json",
            "run",
            "7",
            "--timeout-ms",
            "250",
            "echo",
            "ok",
        ]))
        .unwrap();

        assert_eq!(parsed.socket, PathBuf::from("/tmp/oco.sock"));
        assert!(parsed.json);
        assert_eq!(parsed.request.op, ControlOp::Run);
        assert_eq!(parsed.request.selector.as_deref(), Some("7"));
        assert_eq!(parsed.request.timeout_ms, Some(250));
        assert_eq!(parsed.request.text.as_deref(), Some("echo ok"));
    }
}
