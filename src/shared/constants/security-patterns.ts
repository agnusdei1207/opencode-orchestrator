/**
 * Security Patterns & Constants
 * 
 * Centralized definition of dangerous patterns, secrets, and security rules.
 */

export const SECURITY_PATTERNS = {
    // Dangerous Commands
    // Compared after whitespace removal so spacing variants cannot slip past.
    FORK_BOMB: ":(){:|:&};:",
    // `rm` with any flags (-rf, -fr, -Rf, --no-preserve-root) targeting `/` or `/*`,
    // ending the command or followed by a shell separator. Scoped paths like `/tmp/x` pass.
    ROOT_DELETION: /\brm\s+(?:-{1,2}[\w-]+\s+)*(?:--\s+)?\/\*?(?=\s*(?:$|[;&|]))/,

    // Secret Detection
    SECRETS: [
        // OpenAI (legacy, sk-proj-, sk-svcacct-) and Anthropic (sk-ant-) keys.
        // The word boundary keeps identifiers such as `task-...` from matching.
        /\bsk-[A-Za-z0-9][A-Za-z0-9_-]{19,}/g,
        /(AWS|aws|Aws)?[_ ]?(SECRET|secret|Secret)?[_ ]?(KEY|key|Key)[:= ]+[A-Za-z0-9\/+]{40}/g, // AWS Secret Key
        /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, // AWS access key id
        /\bgh[pousr]_[A-Za-z0-9]{36,}/g, // GitHub classic, OAuth, user, server and refresh tokens
        /\bgithub_pat_[A-Za-z0-9_]{22,}/g, // GitHub fine-grained PAT
        /\bAIza[0-9A-Za-z_-]{35}/g, // Google API key
        /xox[baprs]-([0-9a-zA-Z]{10,48})/g, // Slack Token
        /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, // PEM private key
    ]
} as const;
