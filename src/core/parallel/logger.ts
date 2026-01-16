/**
 * Debug logger for parallel agent
 */

const DEBUG = process.env.DEBUG_PARALLEL_AGENT === "true";

export function log(...args: unknown[]): void {
    if (DEBUG) console.log("[parallel-agent]", ...args);
}
