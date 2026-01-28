/**
 * Debug logger for parallel agent
 * 
 * DISABLED: File logging removed to eliminate I/O overhead.
 * All log calls are now no-ops for maximum performance.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function log(..._args: unknown[]): void {
    // No-op: Logging disabled for performance
}

export function getLogPath(): string {
    return "";
}
