//! HTTP client tool (curl-like)

use crate::tools::process::run_with_timeout;
use crate::{Error, Result};
use std::collections::HashMap;
use std::process::Command;
use std::time::Duration;

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

/// HTTP response
#[derive(Debug, Clone)]
pub struct HttpResponse {
    pub status_code: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
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
    pub fn request(
        &self,
        method: HttpMethod,
        url: &str,
        headers: Option<&HashMap<String, String>>,
        body: Option<&str>,
    ) -> Result<HttpResponse> {
        let mut cmd = Command::new("curl");

        // Silent mode but show errors
        cmd.arg("-sS");

        // Include headers in output
        cmd.arg("-i");

        // Method
        cmd.arg("-X").arg(method.as_str());

        // Timeout
        cmd.arg("--max-time")
            .arg(self.config.timeout.as_secs().to_string());

        // Follow redirects
        if self.config.follow_redirects {
            cmd.arg("-L");
        }

        // SSL verification
        if !self.config.verify_ssl {
            cmd.arg("-k");
        }

        // Headers
        if let Some(hdrs) = headers {
            for (key, value) in hdrs {
                cmd.arg("-H").arg(format!("{}: {}", key, value));
            }
        }

        // Body
        if let Some(data) = body {
            cmd.arg("-d").arg(data);
        }

        cmd.arg(url);

        // curl enforces its own `--max-time`; the hard timeout is a slightly
        // larger backstop so a wedged curl process is still reaped.
        let hard_timeout = self.config.timeout + Duration::from_secs(5);
        let output = run_with_timeout(cmd, hard_timeout, None)?;

        // curl exits non-zero on transport/protocol failures (DNS, refused
        // connection, TLS). Surface that instead of reporting a fake 0 status.
        if !output.status.success() {
            return Err(Error::Tool(format!(
                "curl failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            )));
        }

        let response_text = String::from_utf8_lossy(&output.stdout);
        Self::parse_curl_response(&response_text)
    }

    /// Parse a `curl -i` response into status, headers, and body.
    ///
    /// With `-L` curl prints one header block per redirect hop, so the real
    /// response is the block starting at the last `HTTP/` status line.
    fn parse_curl_response(response_text: &str) -> Result<HttpResponse> {
        let bytes = response_text.as_bytes();
        let last_status = response_text
            .match_indices("HTTP/")
            .filter(|(idx, _)| *idx == 0 || bytes[idx - 1] == b'\n')
            .map(|(idx, _)| idx)
            .last();

        let start = last_status
            .ok_or_else(|| Error::Tool("curl response missing HTTP status line".to_string()))?;

        let block = &response_text[start..];
        let mut lines = block.lines();
        let status_line = lines.next().unwrap_or("");
        let status_code: u16 = status_line
            .split_whitespace()
            .nth(1)
            .and_then(|s| s.parse().ok())
            .ok_or_else(|| Error::Tool(format!("unparseable HTTP status line: {status_line}")))?;

        let mut headers = HashMap::new();
        let mut body_start = false;
        let mut body_lines = Vec::new();

        for line in lines {
            if body_start {
                body_lines.push(line);
            } else if line.is_empty() {
                body_start = true;
            } else if let Some((key, value)) = line.split_once(':') {
                headers.insert(key.trim().to_string(), value.trim().to_string());
            }
        }

        Ok(HttpResponse {
            status_code,
            headers,
            body: body_lines.join("\n"),
        })
    }

    /// GET request
    pub fn get(
        &self,
        url: &str,
        headers: Option<&HashMap<String, String>>,
    ) -> Result<HttpResponse> {
        self.request(HttpMethod::GET, url, headers, None)
    }

    /// POST request
    pub fn post(
        &self,
        url: &str,
        body: &str,
        headers: Option<&HashMap<String, String>>,
    ) -> Result<HttpResponse> {
        self.request(HttpMethod::POST, url, headers, Some(body))
    }
}

impl Default for HttpTool {
    fn default() -> Self {
        Self::new(HttpConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn rejects_output_without_a_status_line() {
        assert!(HttpTool::parse_curl_response("garbage output").is_err());
    }

    #[test]
    fn rejects_an_unparseable_status_line() {
        assert!(HttpTool::parse_curl_response("HTTP/1.1 not-a-code\r\n\r\n").is_err());
    }
}
