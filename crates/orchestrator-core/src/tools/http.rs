//! HTTP client tool (curl-like)

use crate::Result;
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
        cmd.arg("--max-time").arg(self.config.timeout.as_secs().to_string());
        
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
        
        let output = cmd.output()?;
        let response_text = String::from_utf8_lossy(&output.stdout).to_string();
        
        // Parse response
        let mut lines = response_text.lines();
        let status_line = lines.next().unwrap_or("");
        let status_code = status_line
            .split_whitespace()
            .nth(1)
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        
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
    pub fn get(&self, url: &str, headers: Option<&HashMap<String, String>>) -> Result<HttpResponse> {
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
