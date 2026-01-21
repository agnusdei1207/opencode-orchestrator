/**
 * Security Patterns & Constants
 * 
 * Centralized definition of dangerous patterns, secrets, and security rules.
 */

export const SECURITY_PATTERNS = {
    // Dangerous Commands
    FORK_BOMB: ":(){ :|:& };:",
    ROOT_DELETION: /rm\s+(-r?f?\s+)*\/\s*$/, // rm -rf /

    // Secret Detection
    SECRETS: [
        /sk-[a-zA-Z0-9]{20,}T3BlbkFJ/g, // OpenAI-like
        /(AWS|aws|Aws)?[_ ]?(SECRET|secret|Secret)?[_ ]?(KEY|key|Key)[:= ]+[A-Za-z0-9\/+]{40}/g, // AWS Secret Key
        /ghp_[a-zA-Z0-9]{36}/g, // GitHub PAT
        /xox[baprs]-([0-9a-zA-Z]{10,48})/g // Slack Token
    ]
} as const;

export const UI_PATTERNS = {
    TASK_ID: /\[(TASK-\d+)\]/i
} as const;
