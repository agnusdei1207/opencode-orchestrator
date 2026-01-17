/**
 * Debug logger for parallel agent
 * Logs to both console (when DEBUG=true) and file (always)
 * Log file location: /tmp/opencode-orchestrator.log (or OS temp dir)
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const DEBUG = process.env.DEBUG_PARALLEL_AGENT === "true";
const LOG_FILE = path.join(os.tmpdir(), "opencode-orchestrator.log");

export function log(...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] [parallel-agent] ${args.map(a =>
        typeof a === "object" ? JSON.stringify(a) : String(a)
    ).join(" ")}`;

    // Always write to file
    try {
        fs.appendFileSync(LOG_FILE, message + "\n");
    } catch { /* ignore file errors */ }

    // Console only when DEBUG
    if (DEBUG) console.log("[parallel-agent]", ...args);
}

export function getLogPath(): string {
    return LOG_FILE;
}
