/**
 * Elapsed Time Formatter
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
