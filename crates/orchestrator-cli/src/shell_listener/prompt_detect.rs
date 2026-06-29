use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PromptKind {
    Password,
    YesNo,
    Login,
    TwoFactor,
    Pager,
    Generic,
}

pub fn detect_interactive_prompt(recent_text: &str) -> Option<PromptKind> {
    let tail = tail_chars(recent_text, 4096);
    let last = tail
        .split(['\n', '\r'])
        .rev()
        .find(|line| !line.trim().is_empty())?;
    let lower = last.to_ascii_lowercase();
    let trimmed = lower.trim();

    if matches!(trimmed, "--more--" | "(end)") || trimmed.ends_with("--more--") {
        return Some(PromptKind::Pager);
    }
    if trimmed.contains("[sudo] password for")
        || trimmed.ends_with("password:")
        || trimmed.contains("'s password:")
    {
        return Some(PromptKind::Password);
    }
    if trimmed.contains("(yes/no")
        || trimmed.contains("[yes/no")
        || trimmed.contains("(y/n")
        || trimmed.contains("[y/n")
        || trimmed.contains("are you sure you want to continue connecting")
    {
        return Some(PromptKind::YesNo);
    }
    if trimmed.ends_with("login:")
        || trimmed.ends_with("username:")
        || trimmed.ends_with("user name:")
    {
        return Some(PromptKind::Login);
    }
    let promptish = trimmed.ends_with(':') || trimmed.ends_with('?');
    if promptish
        && (trimmed.contains("verification code")
            || trimmed.contains("one-time code")
            || trimmed.contains("authentication code")
            || trimmed.contains("two-factor")
            || trimmed.contains("2fa")
            || trimmed.contains("otp"))
    {
        return Some(PromptKind::TwoFactor);
    }
    let original = last.trim_end();
    if !original.is_empty()
        && original.len() <= 160
        && (original.ends_with('?') || original.ends_with('>'))
    {
        return Some(PromptKind::Generic);
    }
    None
}

fn tail_chars(text: &str, limit: usize) -> String {
    let mut chars = text.chars().rev().take(limit).collect::<Vec<_>>();
    chars.reverse();
    chars.into_iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_common_prompt_kinds() {
        assert_eq!(
            detect_interactive_prompt("[sudo] password for alice:"),
            Some(PromptKind::Password)
        );
        assert_eq!(
            detect_interactive_prompt("Proceed? [y/N]"),
            Some(PromptKind::YesNo)
        );
        assert_eq!(
            detect_interactive_prompt("Verification code:"),
            Some(PromptKind::TwoFactor)
        );
        assert_eq!(
            detect_interactive_prompt("--More--"),
            Some(PromptKind::Pager)
        );
    }

    #[test]
    fn avoids_common_non_prompts() {
        assert_eq!(detect_interactive_prompt("password changed\n"), None);
        assert_eq!(detect_interactive_prompt("compiled 12 targets\n"), None);
    }
}
