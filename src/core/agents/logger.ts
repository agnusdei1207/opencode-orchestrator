/**
 * Debug logger for parallel agent
 * 
 * DISABLED: File logging removed to eliminate I/O overhead.
 * All log calls are now no-ops for maximum performance.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function log(..._args: unknown[]): void {
    // No-op: Logging disabled for performance
    // Enable DEBUG_PARALLEL_AGENT=true for console output if needed
    if (process.env.DEBUG_PARALLEL_AGENT === "true") {
        console.log("[parallel-agent]", ..._args);
    }
}

export function getLogPath(): string {
    return "";
}
