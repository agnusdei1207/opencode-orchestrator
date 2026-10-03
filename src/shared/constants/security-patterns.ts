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
        /sk-[a-zA-Z0-9]{20,}T3BlbkFJ/g, // OpenAI-like
        /(AWS|aws|Aws)?[_ ]?(SECRET|secret|Secret)?[_ ]?(KEY|key|Key)[:= ]+[A-Za-z0-9\/+]{40}/g, // AWS Secret Key
        /ghp_[a-zA-Z0-9]{36}/g, // GitHub PAT
        /xox[baprs]-([0-9a-zA-Z]{10,48})/g // Slack Token
    ]
} as const;
