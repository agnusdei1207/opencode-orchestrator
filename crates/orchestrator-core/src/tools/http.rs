//! HTTP client tool (curl-like)

use crate::tools::process::{CapturedOutput, run_with_timeout};
use crate::{Error, Result};
use std::collections::HashMap;
use std::process::Command;
use std::str::FromStr;
use std::time::Duration;

/// Only plain web protocols may be requested or followed through redirects;
/// curl would otherwise also fetch `file://`, `dict://`, `gopher://`, ...
const ALLOWED_PROTOCOLS: &str = "=http,https";
/// Smallest `--max-time` handed to curl, because `0` means "no limit" to it.
const MIN_MAX_TIME: Duration = Duration::from_millis(1);
/// Grace period of the hard process timeout on top of curl's own `--max-time`.
const HARD_TIMEOUT_GRACE: Duration = Duration::from_secs(5);
const HTTP_STATUS_PREFIX: &str = "HTTP/";
const SET_COOKIE: &str = "set-cookie";
/// RFC 9110 `tchar` symbols allowed in a header name besides ASCII alphanumerics.
const HEADER_NAME_SYMBOLS: &str = "!#$%&'*+-.^_`|~";

/// HTTP method
#[derive(Debug, Clone, Copy)]
pub enum HttpMethod {
    GET,
    POST,
    PUT,
    DELETE,
    PATCH,
    HEAD,
}

impl HttpMethod {
    pub fn as_str(&self) -> &str {
        match self {
            HttpMethod::GET => "GET",
            HttpMethod::POST => "POST",
            HttpMethod::PUT => "PUT",
            HttpMethod::DELETE => "DELETE",
            HttpMethod::PATCH => "PATCH",
            HttpMethod::HEAD => "HEAD",
        }
    }
}

impl FromStr for HttpMethod {
    type Err = Error;

    /// Case-insensitive; unknown verbs are an error rather than a silent GET.
    fn from_str(value: &str) -> Result<Self> {
        match value.to_ascii_uppercase().as_str() {
            "GET" => Ok(HttpMethod::GET),
            "POST" => Ok(HttpMethod::POST),
            "PUT" => Ok(HttpMethod::PUT),
            "DELETE" => Ok(HttpMethod::DELETE),
            "PATCH" => Ok(HttpMethod::PATCH),
            "HEAD" => Ok(HttpMethod::HEAD),
            _ => Err(Error::Tool(format!("unsupported HTTP method: {value}"))),
        }
    }
}

/// Configuration for HTTP operations
#[derive(Debug, Clone)]
pub struct HttpConfig {
    /// Request timeout
    pub timeout: Duration,
    /// Follow redirects
    pub follow_redirects: bool,
    /// Verify SSL
    pub verify_ssl: bool,
}

impl Default for HttpConfig {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(30),
            follow_redirects: true,
            verify_ssl: true,
        }
    }
}

/// A single HTTP request to send through curl
#[derive(Debug, Clone, Copy)]
pub struct HttpRequest<'a> {
    pub method: HttpMethod,
    pub url: &'a str,
    pub headers: Option<&'a HashMap<String, String>>,
    pub body: Option<&'a str>,
}

/// HTTP response
#[derive(Debug, Clone)]
pub struct HttpResponse {
    pub status_code: u16,
    /// Response headers of the final response. Repeated headers are merged:
    /// `Set-Cookie` values are joined with `"\n"` (cookie values may contain
    /// commas), every other header with `", "` as RFC 9110 §5.3 permits.
    pub headers: HashMap<String, String>,
    pub body: String,
    /// `body` stops at the capture limit; the server sent more.
    pub truncated: bool,
}

/// HTTP client tool using curl
pub struct HttpTool {
    config: HttpConfig,
}

impl HttpTool {
    pub fn new(config: HttpConfig) -> Self {
        Self { config }
    }

    /// Make HTTP request
    pub fn request(&self, request: HttpRequest<'_>) -> Result<HttpResponse> {
        let (cmd, stdin_data) = self.build_command(request)?;

        // curl enforces its own `--max-time`; the hard timeout is a slightly
        // larger backstop so a wedged curl process is still reaped.
        let hard_timeout = self.config.timeout + HARD_TIMEOUT_GRACE;
        let output = run_with_timeout(cmd, hard_timeout, stdin_data.as_deref())?;
        Self::response_from(&output)
    }

    /// curl exits non-zero on transport/protocol failures (DNS, refused
    /// connection, TLS). Surface that instead of reporting a fake 0 status.
    fn response_from(output: &CapturedOutput) -> Result<HttpResponse> {
        if !output.status.success() {
            return Err(Error::Tool(format!(
                "curl failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            )));
        }

        let captured = output.stdout_text();
        let mut response = Self::parse_curl_response(&captured.text)?;
        response.truncated = captured.truncated;
        Ok(response)
    }

    /// Build the curl invocation plus the bytes to feed it on stdin.
    ///
    /// Every caller-controlled value is passed as an option *value*, never as
    /// a bare positional argument, so it cannot be reinterpreted as a curl
    /// option or as an `@file` reference.
    fn build_command(&self, request: HttpRequest<'_>) -> Result<(Command, Option<Vec<u8>>)> {
        let HttpRequest {
            method,
            url,
            headers,
            body,
        } = request;
        let mut cmd = Command::new("curl");
        // Silent but show errors; include response headers in the output.
        cmd.args(["-sS", "-i"]);
        cmd.args(["--proto", ALLOWED_PROTOCOLS]);
        cmd.args(["--proto-redir", ALLOWED_PROTOCOLS]);
        cmd.arg("--max-time")
            .arg(format_max_time(self.config.timeout));
        if self.config.follow_redirects {
            cmd.arg("-L");
        }
        if !self.config.verify_ssl {
            cmd.arg("-k");
        }
        add_method(&mut cmd, method, body.is_some())?;
        add_headers(&mut cmd, headers)?;
        if body.is_some() {
            // `@-` makes curl read the body verbatim from stdin, so a body that
            // starts with `@` can never make it read a local file instead.
            cmd.args(["--data-binary", "@-"]);
        }
        cmd.arg("--url").arg(url);
        Ok((cmd, body.map(|data| data.as_bytes().to_vec())))
    }

    /// Parse a `curl -i` response into status, headers, and body.
    ///
    /// curl prints one header block per interim response (`1xx`), redirect
    /// hop (`-L`), or proxy tunnel before the final response. Only those
    /// leading blocks are treated as headers: everything after the final
    /// block's blank line is the body, even if a body line starts with `HTTP/`.
    fn parse_curl_response(response_text: &str) -> Result<HttpResponse> {
        if !response_text.starts_with(HTTP_STATUS_PREFIX) {
            return Err(Error::Tool(
                "curl response missing HTTP status line".to_string(),
            ));
        }

        let mut rest = response_text;
        loop {
            let (block, after) = split_header_block(rest);
            let (status_code, reason, headers) = parse_header_block(block)?;
            if precedes_another_block(status_code, reason) && after.starts_with(HTTP_STATUS_PREFIX)
            {
                rest = after;
                continue;
            }
            return Ok(HttpResponse {
                status_code,
                headers,
                body: after.to_string(),
                truncated: false,
            });
        }
    }
}

impl Default for HttpTool {
    fn default() -> Self {
        Self::new(HttpConfig::default())
    }
}

fn add_method(cmd: &mut Command, method: HttpMethod, has_body: bool) -> Result<()> {
    match method {
        // `-X HEAD` makes curl wait for a body that never arrives until the
        // timeout; `--head` tells it the response has none.
        HttpMethod::HEAD if has_body => {
            Err(Error::Tool("HEAD requests cannot carry a body".to_string()))
        }
        HttpMethod::HEAD => {
            cmd.arg("--head");
            Ok(())
        }
        _ => {
            cmd.arg("-X").arg(method.as_str());
            Ok(())
        }
    }
}

fn add_headers(cmd: &mut Command, headers: Option<&HashMap<String, String>>) -> Result<()> {
    for (name, value) in headers.into_iter().flatten() {
        // A name outside the token grammar (e.g. starting with `@`) would let
        // curl read headers from a file; CR/LF would inject extra headers.
        let valid_name = !name.is_empty()
            && name
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || HEADER_NAME_SYMBOLS.contains(c));
        if !valid_name || value.contains(['\r', '\n']) {
            return Err(Error::Tool(format!("invalid HTTP header: {name}")));
        }
        cmd.arg("-H").arg(format!("{name}: {value}"));
    }
    Ok(())
}

/// Format a timeout for curl's `--max-time`, keeping sub-second precision.
///
/// Whole seconds stay integers; fractional values use three decimals and
/// never round down to `0`, which curl treats as "no timeout".
fn format_max_time(timeout: Duration) -> String {
    let timeout = timeout.max(MIN_MAX_TIME);
    if timeout.subsec_nanos() == 0 {
        timeout.as_secs().to_string()
    } else {
        format!("{:.3}", timeout.as_secs_f64())
    }
}

/// Split `text` at its first empty line into (header block, remainder).
fn split_header_block(text: &str) -> (&str, &str) {
    let mut offset = 0;
    for line in text.split_inclusive('\n') {
        let line_start = offset;
        offset += line.len();
        if line.trim_end_matches(['\r', '\n']).is_empty() {
            return (&text[..line_start], &text[offset..]);
        }
    }
    (text, "")
}

type HeaderBlock<'a> = (u16, &'a str, HashMap<String, String>);

fn parse_header_block(block: &str) -> Result<HeaderBlock<'_>> {
    let mut lines = block.lines();
    let status_line = lines.next().unwrap_or("");
    let mut parts = status_line.splitn(3, ' ');
    let status_code: u16 = parts
        .nth(1)
        .and_then(|code| code.trim().parse().ok())
        .ok_or_else(|| Error::Tool(format!("unparseable HTTP status line: {status_line}")))?;
    let reason = parts.next().unwrap_or("").trim();

    let mut headers = HashMap::new();
    for line in lines {
        if let Some((name, value)) = line.split_once(':') {
            insert_header(&mut headers, name.trim(), value.trim());
        }
    }
    Ok((status_code, reason, headers))
}

/// Whether curl prints another header block after a response with this status:
/// interim `1xx`, redirect hops, and a proxy's CONNECT `200 Connection established`.
fn precedes_another_block(status_code: u16, reason: &str) -> bool {
    matches!(status_code, 100..=199 | 300..=399)
        || (status_code == 200 && reason.eq_ignore_ascii_case("connection established"))
}

fn insert_header(headers: &mut HashMap<String, String>, name: &str, value: &str) {
    let existing = headers
        .iter_mut()
        .find(|(key, _)| key.eq_ignore_ascii_case(name))
        .map(|(_, current)| current);
    match existing {
        Some(current) => {
            let separator = if name.eq_ignore_ascii_case(SET_COOKIE) {
                "\n"
            } else {
                ", "
            };
            current.push_str(separator);
            current.push_str(value);
        }
        None => {
            headers.insert(name.to_string(), value.to_string());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tools::process::finished_with_stdout;

    #[test]
    fn method_strings_match_http_verbs() {
        assert_eq!(HttpMethod::GET.as_str(), "GET");
        assert_eq!(HttpMethod::DELETE.as_str(), "DELETE");
        assert_eq!(HttpMethod::PATCH.as_str(), "PATCH");
    }

    #[test]
    fn parses_status_headers_and_body() {
        let raw = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"ok\":true}";
        let response = HttpTool::parse_curl_response(raw).unwrap();
        assert_eq!(response.status_code, 200);
        assert_eq!(
            response.headers.get("Content-Type").map(String::as_str),
            Some("application/json")
        );
        assert_eq!(response.body, "{\"ok\":true}");
    }

    #[test]
    fn uses_the_final_block_after_redirects() {
        let raw =
            "HTTP/1.1 301 Moved Permanently\r\nLocation: /next\r\n\r\nHTTP/1.1 200 OK\r\n\r\nbody";
        let response = HttpTool::parse_curl_response(raw).unwrap();
        assert_eq!(response.status_code, 200);
        assert_eq!(response.body, "body");
    }

    #[test]
    fn a_body_cut_at_the_capture_limit_is_flagged_as_truncated() {
        let raw = b"HTTP/1.1 200 OK\r\n\r\npartial";
        let complete = HttpTool::response_from(&finished_with_stdout(raw, false)).unwrap();
        let cut = HttpTool::response_from(&finished_with_stdout(raw, true)).unwrap();

        assert!(!complete.truncated);
        assert!(cut.truncated);
        assert_eq!(cut.body, "partial");
    }

    #[test]
    fn rejects_output_without_a_status_line() {
        assert!(HttpTool::parse_curl_response("garbage output").is_err());
    }

    #[test]
    fn rejects_an_unparseable_status_line() {
        assert!(HttpTool::parse_curl_response("HTTP/1.1 not-a-code\r\n\r\n").is_err());
    }

    fn args_of(command: &Command) -> Vec<String> {
        command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect()
    }

    fn request<'a>(
        method: HttpMethod,
        url: &'a str,
        headers: Option<&'a HashMap<String, String>>,
        body: Option<&'a str>,
    ) -> HttpRequest<'a> {
        HttpRequest {
            method,
            url,
            headers,
            body,
        }
    }

    #[test]
    fn body_is_sent_through_stdin_so_curl_never_reads_a_local_file() {
        let tool = HttpTool::default();
        let (command, stdin) = tool
            .build_command(request(
                HttpMethod::POST,
                "https://example.test",
                None,
                Some("@/etc/passwd"),
            ))
            .unwrap();
        let args = args_of(&command);

        assert!(!args.iter().any(|arg| arg == "@/etc/passwd"));
        assert!(!args.iter().any(|arg| arg == "-d"));
        let data_index = args.iter().position(|arg| arg == "--data-binary").unwrap();
        assert_eq!(args[data_index + 1], "@-");
        assert_eq!(stdin.as_deref(), Some("@/etc/passwd".as_bytes()));
    }

    #[test]
    fn url_is_passed_as_an_option_value_with_http_only_protocols() {
        let tool = HttpTool::default();
        let (command, _) = tool
            .build_command(request(HttpMethod::GET, "-K/etc/curlrc", None, None))
            .unwrap();
        let args = args_of(&command);

        let url_index = args.iter().position(|arg| arg == "--url").unwrap();
        assert_eq!(args[url_index + 1], "-K/etc/curlrc");
        let proto_index = args.iter().position(|arg| arg == "--proto").unwrap();
        assert_eq!(args[proto_index + 1], "=http,https");
        let redir_index = args.iter().position(|arg| arg == "--proto-redir").unwrap();
        assert_eq!(args[redir_index + 1], "=http,https");
    }

    #[test]
    fn head_requests_use_the_head_flag_instead_of_a_custom_method() {
        let tool = HttpTool::default();
        let (command, _) = tool
            .build_command(request(
                HttpMethod::HEAD,
                "https://example.test",
                None,
                None,
            ))
            .unwrap();
        let args = args_of(&command);

        assert!(args.iter().any(|arg| arg == "--head"));
        assert!(!args.iter().any(|arg| arg == "-X"));
    }

    #[test]
    fn head_requests_reject_a_body() {
        let tool = HttpTool::default();
        assert!(
            tool.build_command(request(
                HttpMethod::HEAD,
                "https://example.test",
                None,
                Some("x")
            ))
            .is_err()
        );
    }

    #[test]
    fn header_names_that_curl_would_treat_as_a_file_are_rejected() {
        let tool = HttpTool::default();
        let mut headers = HashMap::new();
        headers.insert("@/etc/passwd".to_string(), "x".to_string());
        assert!(
            tool.build_command(request(
                HttpMethod::GET,
                "https://example.test",
                Some(&headers),
                None
            ))
            .is_err()
        );
    }

    #[test]
    fn sub_second_timeouts_are_not_rounded_down_to_unlimited() {
        assert_eq!(format_max_time(Duration::from_millis(250)), "0.250");
        assert_eq!(format_max_time(Duration::from_secs(30)), "30");
        assert_eq!(format_max_time(Duration::from_millis(1500)), "1.500");
        assert_eq!(format_max_time(Duration::ZERO), "0.001");
    }

    #[test]
    fn method_names_parse_case_insensitively_and_reject_unknown_verbs() {
        assert!(matches!("post".parse::<HttpMethod>(), Ok(HttpMethod::POST)));
        assert!(matches!("HEAD".parse::<HttpMethod>(), Ok(HttpMethod::HEAD)));
        assert!("FETCH".parse::<HttpMethod>().is_err());
    }

    #[test]
    fn body_lines_that_look_like_status_lines_do_not_replace_the_response() {
        let raw = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nline one\nHTTP/1.1 500 Fake\nX-Fake: yes\n\nrest";
        let response = HttpTool::parse_curl_response(raw).unwrap();
        assert_eq!(response.status_code, 200);
        assert!(!response.headers.contains_key("X-Fake"));
        assert_eq!(
            response.body,
            "line one\nHTTP/1.1 500 Fake\nX-Fake: yes\n\nrest"
        );
    }

    #[test]
    fn interim_continue_responses_are_skipped() {
        let raw = "HTTP/1.1 100 Continue\r\n\r\nHTTP/1.1 201 Created\r\nLocation: /x\r\n\r\ndone";
        let response = HttpTool::parse_curl_response(raw).unwrap();
        assert_eq!(response.status_code, 201);
        assert_eq!(response.body, "done");
    }

    #[test]
    fn repeated_headers_are_joined_instead_of_dropped() {
        let raw = "HTTP/1.1 200 OK\r\nVary: Accept\r\nvary: Origin\r\nSet-Cookie: a=1\r\nSet-Cookie: b=2\r\n\r\n";
        let response = HttpTool::parse_curl_response(raw).unwrap();
        assert_eq!(
            response.headers.get("Vary").map(String::as_str),
            Some("Accept, Origin")
        );
        assert_eq!(
            response.headers.get("Set-Cookie").map(String::as_str),
            Some("a=1\nb=2")
        );
    }
}
