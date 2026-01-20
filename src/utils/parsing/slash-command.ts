/**
 * Slash Command Parser
 */

export function detectSlashCommand(text: string): { command: string; args: string } | null {
    const match = text.trim().match(/^\/([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
    if (!match) return null;
    return { command: match[1].toLowerCase(), args: match[2] || "" };
}
