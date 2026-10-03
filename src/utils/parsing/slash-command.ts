/**
 * Slash Command Parser
 */

export function detectSlashCommand(text: string): { command: string; args: string } | null {
    // `s` lets the argument span lines; multi-line mission prompts are common.
    const match = text.trim().match(/^\/([a-zA-Z0-9_-]+)(?:\s+(.*))?$/s);
    if (!match) return null;
    return { command: match[1].toLowerCase(), args: match[2] || "" };
}
