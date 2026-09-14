import * as fs from 'node:fs';
import * as path from 'node:path';
import { log } from "../agents/logger.js";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const SESSION_RETENTION_MS = 7 * DAY_MS;

export class CleanupScheduler {
    private timer?: NodeJS.Timeout;

    constructor(private readonly directory: string) { }

    start() {
        if (this.timer) return;
        this.timer = setInterval(() => this.cleanOldSessions(), 5 * MINUTE_MS);
        this.timer.unref();
        log("[Cleanup] Task archive cleanup started");
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
        log("[Cleanup] Scheduler stopped");
    }

    async cleanOldSessions(): Promise<void> {
        try {
            const sessionArchivePath = path.join(this.directory, '.opencode/archive/tasks');
            if (!(await pathExists(sessionArchivePath))) return;

            const files = await fs.promises.readdir(sessionArchivePath);
            const cutoff = Date.now() - SESSION_RETENTION_MS;
            let cleanedCount = 0;

            for (const file of files) {
                if (!file.endsWith('.jsonl')) continue;
                const filePath = path.join(sessionArchivePath, file);
                const stat = await fs.promises.stat(filePath);
                if (stat.mtimeMs < cutoff) {
                    await fs.promises.unlink(filePath);
                    cleanedCount++;
                }
            }

            if (cleanedCount > 0) {
                log(`[Cleanup] Removed ${cleanedCount} old session files (>7 days)`);
            }
        } catch (error) {
            log(`[Cleanup] Session cleanup error: ${error}`);
        }
    }

}

async function pathExists(filePath: string): Promise<boolean> {
    try {
        await fs.promises.access(filePath);
        return true;
    } catch (error) {
        if (isNotFoundError(error)) return false;
        throw error;
    }
}

function isNotFoundError(error: unknown): boolean {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && (error as { code?: unknown }).code === "ENOENT";
}
