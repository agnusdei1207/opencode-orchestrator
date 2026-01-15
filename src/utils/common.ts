export function detectSlashCommand(text: string): { command: string; args: string } | null {
    const match = text.trim().match(/^\/([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
    if (!match) return null;
    return { command: match[1], args: match[2] || "" };
}

/**
 * Format a timestamp in human-readable format: YYYY-MM-DD HH:mm:ss
 */
export function formatTimestamp(date: Date = new Date()): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Calculate and format elapsed time between two timestamps in human-readable format
 * @param startMs Start timestamp in milliseconds
 * @param endMs End timestamp in milliseconds (defaults to now)
 * @returns Formatted string like "2h 30m 15s" or "45s"
 */
export function formatElapsedTime(startMs: number, endMs: number = Date.now()): string {
    const elapsed = endMs - startMs;

    if (elapsed < 0) return "0s";

    const seconds = Math.floor(elapsed / 1000) % 60;
    const minutes = Math.floor(elapsed / (1000 * 60)) % 60;
    const hours = Math.floor(elapsed / (1000 * 60 * 60));

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(' ');
}
