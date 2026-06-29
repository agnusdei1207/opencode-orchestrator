use std::time::{SystemTime, UNIX_EPOCH};

pub const MAX_DISPLAY_LINES: usize = 500;
pub const DEFAULT_LIMIT_BYTES: usize = 8192;

pub const PTY_HELPER: &str =
    "python3 -c 'import os,pty; pty.spawn(os.environ.get(\"SHELL\",\"/bin/sh\"))'\n";

pub fn sanitize_terminal_text(bytes: &[u8]) -> String {
    let input = String::from_utf8_lossy(bytes);
    let mut output = String::new();
    let mut escaping = false;
    for ch in input.chars() {
        if escaping {
            escaping = !ch.is_ascii_alphabetic();
            continue;
        }
        if ch == '\u{1b}' {
            escaping = true;
            continue;
        }
        if ch == '\n' || ch == '\r' || ch == '\t' || !ch.is_control() {
            output.push(ch);
        }
    }
    output
}

pub fn as_line(text: &str) -> String {
    if text.ends_with('\n') {
        text.to_string()
    } else {
        format!("{text}\n")
    }
}

pub fn tail_text(text: &str, limit_bytes: usize) -> String {
    if text.len() <= limit_bytes {
        return text.to_string();
    }
    let mut start = text.len().saturating_sub(limit_bytes);
    while start < text.len() && !text.is_char_boundary(start) {
        start += 1;
    }
    text[start..].to_string()
}

pub fn sentinel_token() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("__OCO_DONE_{millis}__")
}

pub fn wrap_with_sentinel(command: &str, sentinel: &str) -> String {
    format!("{}\necho {}\n", command.trim_end(), sentinel)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_removes_escape_sequences() {
        assert_eq!(sanitize_terminal_text(b"\x1b[31mred\x1b[0m\n"), "red\n");
    }

    #[test]
    fn sentinel_wrapper_appends_marker() {
        assert_eq!(wrap_with_sentinel("id", "__DONE__"), "id\necho __DONE__\n");
    }
}
