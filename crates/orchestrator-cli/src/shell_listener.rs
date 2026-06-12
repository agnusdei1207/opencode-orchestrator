use anyhow::{Context, Result, bail};
use std::collections::{BTreeMap, VecDeque};
use std::fs::{self, OpenOptions};
use std::io::{self, BufRead, Read, Write};
use std::net::{IpAddr, Shutdown, SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const DEFAULT_BIND: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 4444;
const MAX_BUFFER_LINES: usize = 200;
const PTY_HELPER: &str =
    "python3 -c 'import os,pty; pty.spawn(os.environ.get(\"SHELL\",\"/bin/sh\"))'\n";

type SharedState = Arc<Mutex<ListenerState>>;

#[derive(Debug, Clone)]
struct ListenerConfig {
    bind: IpAddr,
    port: u16,
    allow_remote: bool,
    log_dir: PathBuf,
    no_tui: bool,
    show_help: bool,
}

#[derive(Debug)]
struct ListenerState {
    next_id: u64,
    active_id: Option<u64>,
    sessions: BTreeMap<u64, SessionInfo>,
}

#[derive(Debug)]
struct SessionInfo {
    peer: SocketAddr,
    log_path: PathBuf,
    writer: Arc<Mutex<TcpStream>>,
    output: VecDeque<String>,
    closed: bool,
}

#[derive(Debug)]
enum ListenerEvent {
    Connected(u64, SocketAddr),
    Output(u64, String),
    Closed(u64),
    Error(String),
}

#[derive(Debug, PartialEq, Eq)]
enum OperatorCommand {
    Empty,
    Help,
    Sessions,
    Redraw,
    Use(u64),
    Detach,
    Pty,
    Close(Option<u64>),
    Quit,
    Send(String),
    Run(String),
}

pub fn run(args: &[String]) -> Result<()> {
    let config = ListenerConfig::parse(args)?;
    if config.show_help {
        print_shell_help();
        return Ok(());
    }

    config.validate()?;
    fs::create_dir_all(&config.log_dir)?;
    let listener = TcpListener::bind(config.socket_addr())?;
    listener.set_nonblocking(true)?;
    print_startup(&config, listener.local_addr()?);

    let state = Arc::new(Mutex::new(ListenerState::new()));
    let shutdown = Arc::new(AtomicBool::new(false));
    let (tx, rx) = mpsc::channel();
    spawn_accept_loop(
        listener,
        config.log_dir.clone(),
        state.clone(),
        tx,
        shutdown.clone(),
    );

    if config.no_tui {
        run_event_printer(rx, shutdown);
        return Ok(());
    }

    run_operator_loop(state, rx, shutdown)
}

impl Default for ListenerConfig {
    fn default() -> Self {
        Self {
            bind: DEFAULT_BIND.parse().expect("valid default bind"),
            port: DEFAULT_PORT,
            allow_remote: false,
            log_dir: PathBuf::from(".opencode-orchestrator/shell-listener"),
            no_tui: false,
            show_help: false,
        }
    }
}

impl ListenerConfig {
    fn parse(args: &[String]) -> Result<Self> {
        let mut config = Self::default();
        let mut index = 0;
        while index < args.len() {
            index = parse_flag(args, index, &mut config)?;
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
}

impl ListenerState {
    fn new() -> Self {
        Self {
            next_id: 1,
            active_id: None,
            sessions: BTreeMap::new(),
        }
    }

    fn add_session(
        &mut self,
        peer: SocketAddr,
        writer: Arc<Mutex<TcpStream>>,
        log_path: PathBuf,
    ) -> u64 {
        let id = self.next_id;
        self.next_id += 1;
        self.active_id.get_or_insert(id);
        self.sessions
            .insert(id, SessionInfo::new(peer, writer, log_path));
        id
    }
}

impl SessionInfo {
    fn new(peer: SocketAddr, writer: Arc<Mutex<TcpStream>>, log_path: PathBuf) -> Self {
        Self {
            peer,
            log_path,
            writer,
            output: VecDeque::new(),
            closed: false,
        }
    }
}

fn parse_flag(args: &[String], index: usize, config: &mut ListenerConfig) -> Result<usize> {
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
        "--allow-remote" => {
            config.allow_remote = true;
            Ok(index + 1)
        }
        "--no-tui" => {
            config.no_tui = true;
            Ok(index + 1)
        }
        "--help" | "-h" => {
            config.show_help = true;
            Ok(index + 1)
        }
        flag => bail!("unknown shell-listener flag: {flag}"),
    }
}

fn require_value<'a>(args: &'a [String], index: usize, flag: &str) -> Result<&'a str> {
    args.get(index + 1)
        .map(String::as_str)
        .filter(|value| !value.starts_with("--"))
        .with_context(|| format!("{flag} requires a value"))
}

fn print_startup(config: &ListenerConfig, local_addr: SocketAddr) {
    println!("OpenCode Orchestrator shell listener");
    println!("listening: {local_addr}");
    println!("logs: {}", config.log_dir.display());
    println!("type 'help' for TUI commands");
}

fn print_shell_help() {
    println!("Usage: orchestrator shell-listener [options]");
    println!();
    println!("Options:");
    println!("  --bind <ip>        Bind address (default: {DEFAULT_BIND})");
    println!("  --port <port>      Bind port (default: {DEFAULT_PORT})");
    println!("  --allow-remote     Permit non-loopback bind addresses");
    println!("  --log-dir <path>   Raw stream log directory");
    println!("  --no-tui           Print connection events without operator input");
    println!();
    println!("TUI commands: sessions, use <id>, send <text>, run <cmd>, pty, close [id], quit");
}

fn spawn_accept_loop(
    listener: TcpListener,
    log_dir: PathBuf,
    state: SharedState,
    tx: Sender<ListenerEvent>,
    shutdown: Arc<AtomicBool>,
) {
    thread::spawn(move || accept_loop(listener, log_dir, state, tx, shutdown));
}

fn accept_loop(
    listener: TcpListener,
    log_dir: PathBuf,
    state: SharedState,
    tx: Sender<ListenerEvent>,
    shutdown: Arc<AtomicBool>,
) {
    while !shutdown.load(Ordering::SeqCst) {
        match listener.accept() {
            Ok((stream, peer)) => register_stream(stream, peer, &log_dir, &state, &tx),
            Err(err) if err.kind() == io::ErrorKind::WouldBlock => sleep_tick(),
            Err(err) => emit(&tx, ListenerEvent::Error(format!("accept failed: {err}"))),
        }
    }
}

fn register_stream(
    stream: TcpStream,
    peer: SocketAddr,
    log_dir: &Path,
    state: &SharedState,
    tx: &Sender<ListenerEvent>,
) {
    match prepare_session(stream, peer, log_dir, state) {
        Ok((id, reader, log_path)) => {
            emit(tx, ListenerEvent::Connected(id, peer));
            spawn_reader(id, reader, log_path, state.clone(), tx.clone());
        }
        Err(err) => emit(
            tx,
            ListenerEvent::Error(format!("session setup failed: {err}")),
        ),
    }
}

fn prepare_session(
    stream: TcpStream,
    peer: SocketAddr,
    log_dir: &Path,
    state: &SharedState,
) -> Result<(u64, TcpStream, PathBuf)> {
    stream.set_nonblocking(true)?;
    let writer = Arc::new(Mutex::new(stream.try_clone()?));
    let log_path = log_path_for(log_dir, peer);
    let id =
        state
            .lock()
            .expect("listener state poisoned")
            .add_session(peer, writer, log_path.clone());
    Ok((id, stream, log_path))
}

fn spawn_reader(
    id: u64,
    stream: TcpStream,
    log_path: PathBuf,
    state: SharedState,
    tx: Sender<ListenerEvent>,
) {
    thread::spawn(move || receive_loop(id, stream, log_path, state, tx));
}

fn receive_loop(
    id: u64,
    mut stream: TcpStream,
    log_path: PathBuf,
    state: SharedState,
    tx: Sender<ListenerEvent>,
) {
    let mut buffer = [0_u8; 4096];
    loop {
        match stream.read(&mut buffer) {
            Ok(0) => break,
            Ok(size) => handle_input_chunk(id, &buffer[..size], &log_path, &state, &tx),
            Err(err) if err.kind() == io::ErrorKind::WouldBlock => sleep_tick(),
            Err(err) => {
                emit(
                    &tx,
                    ListenerEvent::Error(format!("session {id} read failed: {err}")),
                );
                break;
            }
        }
    }
    mark_closed(id, &state);
    emit(&tx, ListenerEvent::Closed(id));
}

fn handle_input_chunk(
    id: u64,
    bytes: &[u8],
    log_path: &Path,
    state: &SharedState,
    tx: &Sender<ListenerEvent>,
) {
    if let Err(err) = append_raw_log(log_path, bytes) {
        emit(
            tx,
            ListenerEvent::Error(format!("session {id} log failed: {err}")),
        );
    }
    let preview = sanitize_preview(&String::from_utf8_lossy(bytes));
    append_preview(id, &preview, state);
    emit(tx, ListenerEvent::Output(id, preview));
}

fn run_operator_loop(
    state: SharedState,
    rx: Receiver<ListenerEvent>,
    shutdown: Arc<AtomicBool>,
) -> Result<()> {
    spawn_event_renderer(rx, state.clone(), shutdown.clone());
    let stdin = io::stdin();
    print_prompt();
    for line in stdin.lock().lines() {
        let command = parse_operator_command(&line?)?;
        if handle_operator_command(command, &state, &shutdown)? {
            break;
        }
        print_prompt();
    }
    shutdown.store(true, Ordering::SeqCst);
    Ok(())
}

fn spawn_event_renderer(
    rx: Receiver<ListenerEvent>,
    state: SharedState,
    shutdown: Arc<AtomicBool>,
) {
    thread::spawn(move || {
        while !shutdown.load(Ordering::SeqCst) {
            if let Ok(event) = rx.recv_timeout(Duration::from_millis(200)) {
                print_event(event, &state);
            }
        }
    });
}

fn run_event_printer(rx: Receiver<ListenerEvent>, shutdown: Arc<AtomicBool>) {
    while !shutdown.load(Ordering::SeqCst) {
        if let Ok(event) = rx.recv_timeout(Duration::from_millis(500)) {
            println!("{}", event_line(&event));
        }
    }
}

fn handle_operator_command(
    command: OperatorCommand,
    state: &SharedState,
    shutdown: &Arc<AtomicBool>,
) -> Result<bool> {
    match command {
        OperatorCommand::Empty => Ok(false),
        OperatorCommand::Help => {
            print_shell_help();
            Ok(false)
        }
        OperatorCommand::Sessions | OperatorCommand::Redraw => {
            print_dashboard(state);
            Ok(false)
        }
        OperatorCommand::Use(id) => set_active_session(id, state).map(|_| false),
        OperatorCommand::Detach => detach_session(state).map(|_| false),
        OperatorCommand::Pty => send_to_active(state, PTY_HELPER.as_bytes()).map(|_| false),
        OperatorCommand::Close(id) => close_session(id, state).map(|_| false),
        OperatorCommand::Send(text) => {
            send_to_active(state, as_line(&text).as_bytes()).map(|_| false)
        }
        OperatorCommand::Run(cmd) => run_with_sentinel(state, &cmd).map(|_| false),
        OperatorCommand::Quit => {
            shutdown.store(true, Ordering::SeqCst);
            Ok(true)
        }
    }
}

fn parse_operator_command(line: &str) -> Result<OperatorCommand> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Ok(OperatorCommand::Empty);
    }
    let (head, tail) = split_head(trimmed);
    match head {
        "help" => Ok(OperatorCommand::Help),
        "sessions" => Ok(OperatorCommand::Sessions),
        "redraw" => Ok(OperatorCommand::Redraw),
        "use" => Ok(OperatorCommand::Use(parse_required_id(tail, "use")?)),
        "detach" => Ok(OperatorCommand::Detach),
        "pty" => Ok(OperatorCommand::Pty),
        "close" => Ok(OperatorCommand::Close(parse_optional_id(tail)?)),
        "quit" | "exit" => Ok(OperatorCommand::Quit),
        "send" => Ok(OperatorCommand::Send(tail.to_string())),
        "run" => Ok(OperatorCommand::Run(tail.to_string())),
        _ => Ok(OperatorCommand::Send(trimmed.to_string())),
    }
}

fn split_head(input: &str) -> (&str, &str) {
    input
        .split_once(char::is_whitespace)
        .map(|(head, tail)| (head, tail.trim()))
        .unwrap_or((input, ""))
}

fn parse_required_id(value: &str, command: &str) -> Result<u64> {
    if value.is_empty() {
        bail!("{command} requires a session id");
    }
    Ok(value.parse()?)
}

fn parse_optional_id(value: &str) -> Result<Option<u64>> {
    if value.is_empty() {
        return Ok(None);
    }
    Ok(Some(value.parse()?))
}

fn set_active_session(id: u64, state: &SharedState) -> Result<()> {
    let mut guard = state.lock().expect("listener state poisoned");
    if !guard.sessions.contains_key(&id) {
        bail!("session {id} does not exist");
    }
    guard.active_id = Some(id);
    println!("active session: {id}");
    Ok(())
}

fn detach_session(state: &SharedState) -> Result<()> {
    state.lock().expect("listener state poisoned").active_id = None;
    println!("active session cleared");
    Ok(())
}

fn close_session(id: Option<u64>, state: &SharedState) -> Result<()> {
    let id = id.or_else(|| state.lock().ok()?.active_id);
    let writer = session_writer(state, id.context("no active session")?)?;
    writer
        .lock()
        .expect("session writer poisoned")
        .shutdown(Shutdown::Both)?;
    Ok(())
}

fn send_to_active(state: &SharedState, bytes: &[u8]) -> Result<()> {
    let id = state
        .lock()
        .expect("listener state poisoned")
        .active_id
        .context("no active session")?;
    send_to_session(state, id, bytes)
}

fn send_to_session(state: &SharedState, id: u64, bytes: &[u8]) -> Result<()> {
    let writer = session_writer(state, id)?;
    writer
        .lock()
        .expect("session writer poisoned")
        .write_all(bytes)
        .with_context(|| format!("failed to write to session {id}"))
}

fn session_writer(state: &SharedState, id: u64) -> Result<Arc<Mutex<TcpStream>>> {
    let guard = state.lock().expect("listener state poisoned");
    let session = guard
        .sessions
        .get(&id)
        .with_context(|| format!("session {id} does not exist"))?;
    Ok(session.writer.clone())
}

fn run_with_sentinel(state: &SharedState, command: &str) -> Result<()> {
    if command.trim().is_empty() {
        bail!("run requires a command");
    }
    let sentinel = sentinel_token();
    let wrapped = wrap_with_sentinel(command, &sentinel);
    println!("sentinel: {sentinel}");
    send_to_active(state, wrapped.as_bytes())
}

fn wrap_with_sentinel(command: &str, sentinel: &str) -> String {
    format!("{}\necho {}\n", command.trim_end(), sentinel)
}

fn sentinel_token() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("__OCO_DONE_{millis}__")
}

fn append_preview(id: u64, preview: &str, state: &SharedState) {
    let mut guard = state.lock().expect("listener state poisoned");
    if let Some(session) = guard.sessions.get_mut(&id) {
        for line in preview.lines() {
            session.output.push_back(line.to_string());
            while session.output.len() > MAX_BUFFER_LINES {
                session.output.pop_front();
            }
        }
    }
}

fn mark_closed(id: u64, state: &SharedState) {
    let mut guard = state.lock().expect("listener state poisoned");
    if let Some(session) = guard.sessions.get_mut(&id) {
        session.closed = true;
    }
    if guard.active_id == Some(id) {
        guard.active_id = None;
    }
}

fn append_raw_log(path: &Path, bytes: &[u8]) -> Result<()> {
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    file.write_all(bytes)?;
    Ok(())
}

fn print_event(event: ListenerEvent, state: &SharedState) {
    println!("\r{}", event_line(&event));
    if matches!(event, ListenerEvent::Connected(_, _)) {
        print_dashboard(state);
    }
    print_prompt();
}

fn event_line(event: &ListenerEvent) -> String {
    match event {
        ListenerEvent::Connected(id, peer) => format!("[session_{id}] connected from {peer}"),
        ListenerEvent::Output(id, text) => format!("[session_{id}] {text}"),
        ListenerEvent::Closed(id) => format!("[session_{id}] closed"),
        ListenerEvent::Error(message) => format!("[error] {message}"),
    }
}

fn print_dashboard(state: &SharedState) {
    let guard = state.lock().expect("listener state poisoned");
    println!("sessions:");
    for (id, session) in &guard.sessions {
        let active = if guard.active_id == Some(*id) {
            "*"
        } else {
            " "
        };
        let status = if session.closed { "closed" } else { "open" };
        println!(
            "{active} session_{id} {status} peer={} log={}",
            session.peer,
            session.log_path.display()
        );
    }
}

fn print_prompt() {
    print!("oco-shell> ");
    let _ = io::stdout().flush();
}

fn sanitize_preview(input: &str) -> String {
    let mut output = String::new();
    let mut escaping = false;
    for ch in input.chars() {
        update_sanitized_char(ch, &mut escaping, &mut output);
    }
    output
}

fn update_sanitized_char(ch: char, escaping: &mut bool, output: &mut String) {
    if *escaping {
        *escaping = !ch.is_ascii_alphabetic();
        return;
    }
    if ch == '\u{1b}' {
        *escaping = true;
        return;
    }
    if ch == '\n' || ch == '\r' || ch == '\t' || !ch.is_control() {
        output.push(ch);
    }
}

fn as_line(text: &str) -> String {
    if text.ends_with('\n') {
        text.to_string()
    } else {
        format!("{text}\n")
    }
}

fn log_path_for(log_dir: &Path, peer: SocketAddr) -> PathBuf {
    let peer_name = peer.to_string().replace([':', '.'], "_");
    log_dir.join(format!("session_{peer_name}.raw.log"))
}

fn emit(tx: &Sender<ListenerEvent>, event: ListenerEvent) {
    let _ = tx.send(event);
}

fn sleep_tick() {
    thread::sleep(Duration::from_millis(50));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(values: &[&str]) -> ListenerConfig {
        let args = values
            .iter()
            .map(|value| value.to_string())
            .collect::<Vec<_>>();
        ListenerConfig::parse(&args).expect("config parses")
    }

    #[test]
    fn default_bind_is_loopback() {
        let config = parse(&[]);
        assert_eq!(config.bind.to_string(), DEFAULT_BIND);
        assert_eq!(config.port, DEFAULT_PORT);
        assert!(config.validate().is_ok());
    }

    #[test]
    fn remote_bind_requires_explicit_flag() {
        let config = parse(&["--bind", "0.0.0.0"]);
        assert!(config.validate().is_err());
    }

    #[test]
    fn remote_bind_accepts_allow_remote() {
        let config = parse(&["--bind", "0.0.0.0", "--allow-remote"]);
        assert!(config.validate().is_ok());
    }

    #[test]
    fn parse_send_and_run_commands() {
        assert_eq!(
            parse_operator_command("send whoami").unwrap(),
            OperatorCommand::Send("whoami".to_string())
        );
        assert_eq!(
            parse_operator_command("run id").unwrap(),
            OperatorCommand::Run("id".to_string())
        );
    }

    #[test]
    fn parse_plain_text_as_send() {
        assert_eq!(
            parse_operator_command("docker login registry.example").unwrap(),
            OperatorCommand::Send("docker login registry.example".to_string())
        );
    }

    #[test]
    fn sentinel_wrapper_appends_done_marker() {
        let wrapped = wrap_with_sentinel("whoami", "__OCO_DONE_TEST__");
        assert_eq!(wrapped, "whoami\necho __OCO_DONE_TEST__\n");
    }

    #[test]
    fn run_command_requires_non_empty_text() {
        let state = Arc::new(Mutex::new(ListenerState::new()));
        assert!(run_with_sentinel(&state, "   ").is_err());
    }

    #[test]
    fn sanitize_preview_removes_escape_sequences() {
        let clean = sanitize_preview("\u{1b}[31mred\u{1b}[0m\r\nok");
        assert_eq!(clean, "red\r\nok");
    }

    #[test]
    fn log_path_sanitizes_peer_name() {
        let peer: SocketAddr = "127.0.0.1:4444".parse().unwrap();
        let path = log_path_for(Path::new("logs"), peer);
        assert_eq!(path, PathBuf::from("logs/session_127_0_0_1_4444.raw.log"));
    }
}
