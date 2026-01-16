export declare function detectSlashCommand(text: string): {
    command: string;
    args: string;
} | null;
/**
 * Format a timestamp in human-readable format: YYYY-MM-DD HH:mm:ss
 */
export declare function formatTimestamp(date?: Date): string;
/**
 * Calculate and format elapsed time between two timestamps in human-readable format
 * @param startMs Start timestamp in milliseconds
 * @param endMs End timestamp in milliseconds (defaults to now)
 * @returns Formatted string like "2h 30m 15s" or "45s"
 */
export declare function formatElapsedTime(startMs: number, endMs?: number): string;
