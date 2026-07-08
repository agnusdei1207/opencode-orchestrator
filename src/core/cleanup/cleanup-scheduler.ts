
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream';
import * as DocumentCache from "../cache/document-cache.js";
import { log } from "../agents/logger.js";
import { runMemoryMaintenancePass } from "../knowledge/memory-maintenance-runner.js";

const pipelineAsync = promisify(pipeline);
const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const SESSION_RETENTION_MS = 7 * DAY_MS;
const HISTORY_RETENTION_MS = 30 * DAY_MS;
const DOC_CACHE_MAX_BYTES = 10 * 1024 * 1024;
const FILE_COUNT_LIMIT = 500;

type CleanupTask = {
    name: string;
    intervalMs: number;
    run: () => Promise<void>;
};

/** Opt-in flag for disk-mutating memory lifecycle maintenance. Default OFF. */
function isMemoryMaintenanceEnabled(): boolean {
    const value = process.env.OPENCODE_MEMORY_MAINTENANCE?.trim().toLowerCase();
    return value === "1" || value === "true";
}

export class CleanupScheduler {
    private intervals: Map<string, NodeJS.Timeout> = new Map();
    private directory: string;

    constructor(directory: string) {
        this.directory = directory;
    }

    start() {
        // Immediate cleanup on start
        this.cleanNodeModules().catch(err => log(`[Cleanup] Initial node_modules cleanup failed: ${err}`));

        for (const task of this.createScheduledTasks()) {
            this.schedule(task);
        }

        log(`[Cleanup] Scheduler started with aggressive cleanup intervals`);
    }

    private createScheduledTasks(): CleanupTask[] {
        const tasks: CleanupTask[] = [
            { name: 'session-cleanup', run: () => this.cleanOldSessions(), intervalMs: 5 * MINUTE_MS },
            { name: 'wal-compact', run: () => this.compactWAL(), intervalMs: 10 * MINUTE_MS },
            { name: 'docs-clean', run: () => this.cleanDocs(), intervalMs: 30 * MINUTE_MS },
            { name: 'file-count-limit', run: () => this.enforceFileLimit(), intervalMs: 5 * MINUTE_MS },
            { name: 'node-modules-cleanup', run: () => this.cleanNodeModules(), intervalMs: 30 * MINUTE_MS },
            { name: 'history-rotate', run: () => this.rotateHistory(), intervalMs: 6 * HOUR_MS },
        ];

        if (isMemoryMaintenanceEnabled()) {
            tasks.push({ name: 'memory-maintenance', run: () => this.maintainMemory(), intervalMs: 6 * HOUR_MS });
            log(`[Cleanup] Memory maintenance enabled (OPENCODE_MEMORY_MAINTENANCE)`);
        }

        return tasks;
    }

    private schedule(task: CleanupTask) {
        // Run immediately if it's maintenance? No, usually delayed. 
        // But maybe run once at startup with random delay to avoid stampede?
        // For now, strict interval.
        const timer = setInterval(() => {
            task.run().catch(err => log(`[Cleanup] ${task.name} failed:`, err));
        }, task.intervalMs);

        if (timer.unref) timer.unref();
        this.intervals.set(task.name, timer);
    }

    stop() {
        for (const timer of this.intervals.values()) {
            clearInterval(timer);
        }
        this.intervals.clear();
        log(`[Cleanup] Scheduler stopped`);
    }

    async compactWAL(): Promise<void> {
        // WAL removed - no compaction needed
    }

    /**
     * Apply the Ebbinghaus memory lifecycle (tier moves + tombstones) to
     * generated memory notes. Tier-only — never relocates files. No-op unless
     * opted in via OPENCODE_MEMORY_MAINTENANCE.
     */
    async maintainMemory(): Promise<void> {
        try {
            const result = runMemoryMaintenancePass(this.directory, { apply: true });
            if (result.changedFiles.length > 0) {
                log(`[Cleanup] Memory maintenance updated ${result.changedFiles.length} note(s)`);
            }
        } catch (err) {
            log(`[Cleanup] Memory maintenance failed: ${err}`);
        }
    }

    async cleanDocs(): Promise<void> {
        try {
            const expiredCount = await DocumentCache.cleanExpired();
            if (expiredCount > 0) {
                log(`[Cleanup] Removed ${expiredCount} expired cached document(s)`);
            }

            const stats = await DocumentCache.stats();
            if (stats.totalSize > DOC_CACHE_MAX_BYTES) {
                const allDocs = await DocumentCache.list();
                allDocs.sort((a, b) => new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime());

                const toDelete = allDocs.slice(0, Math.floor(allDocs.length / 2));
                for (const doc of toDelete) {
                    await DocumentCache.remove(doc.url);
                }
                log(`[Cleanup] Pruned ${toDelete.length} documents due to size limit`);
            }
        } catch (error) {
            log(`[Cleanup] Doc cleanup error: ${error}`);
        }
    }

    async rotateHistory(): Promise<void> {
        try {
            const historyPath = path.join(this.directory, '.opencode/archive/todo_history.jsonl');
            if (!(await pathExists(historyPath))) return;

            const stat = await fs.promises.stat(historyPath);
            // Only rotate if file has non-zero size
            if (stat.size === 0) return;

            const dateStr = new Date().toISOString().split('T')[0];
            const archivePath = path.join(
                this.directory,
                `.opencode/archive/todo_history.${dateStr}.jsonl`
            );
            const compressedPath = `${archivePath}.gz`;

            // Rename to temp location
            await fs.promises.rename(historyPath, archivePath);

            // Compress with gzip
            const source = fs.createReadStream(archivePath);
            const destination = fs.createWriteStream(compressedPath);
            const gzip = zlib.createGzip({ level: 9 });
            await pipelineAsync(source, gzip, destination);

            // Remove uncompressed file
            await fs.promises.unlink(archivePath);

            // Create new empty file
            await fs.promises.writeFile(historyPath, '');

            // Prune old archives (> 30 days)
            const archiveDir = path.dirname(historyPath);
            const files = await fs.promises.readdir(archiveDir);
            const cutoff = Date.now() - HISTORY_RETENTION_MS;

            for (const file of files) {
                if (file.startsWith('todo_history.') && (file.endsWith('.jsonl') || file.endsWith('.gz'))) {
                    const filePath = path.join(archiveDir, file);
                    const fStat = await fs.promises.stat(filePath);
                    if (fStat.mtimeMs < cutoff) {
                        await fs.promises.unlink(filePath);
                    }
                }
            }
            log('[Cleanup] Rotated and compressed todo history');
        } catch (error) {
            log(`[Cleanup] History rotation error: ${error}`);
        }
    }

    /**
     * Clean old session files (>7 days)
     */
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

    /**
     * Remove node_modules from .opencode directory
     */
    async cleanNodeModules(): Promise<void> {
        try {
            const nodeModulesPath = path.join(this.directory, '.opencode/node_modules');
            if (await pathExists(nodeModulesPath)) {
                await fs.promises.rm(nodeModulesPath, { recursive: true, force: true });
                log(`[Cleanup] Removed .opencode/node_modules`);
            }

            // Also remove package files
            const packageJson = path.join(this.directory, '.opencode/package.json');
            const lockFile = path.join(this.directory, '.opencode/bun.lock');
            const packageLock = path.join(this.directory, '.opencode/package-lock.json');

            await unlinkIfExists(packageJson);
            await unlinkIfExists(lockFile);
            await unlinkIfExists(packageLock);
        } catch (error) {
            log(`[Cleanup] node_modules cleanup error: ${error}`);
        }
    }

    /**
     * Enforce file count limit (500 files max)
     */
    async enforceFileLimit(): Promise<void> {
        try {
            const opencodeDir = path.join(this.directory, '.opencode');
            if (!(await pathExists(opencodeDir))) return;

            const files = await this.listAllFiles(opencodeDir);

            if (files.length <= FILE_COUNT_LIMIT) return;

            log(`[Cleanup] File count (${files.length}) exceeds limit (${FILE_COUNT_LIMIT}), pruning...`);

            // Get file stats with access time
            const fileStats = await Promise.all(
                files.map(async (file) => {
                    try {
                        const stat = await fs.promises.stat(file);
                        return { path: file, atime: stat.atimeMs };
                    } catch {
                        return null;
                    }
                })
            );

            const validStats = fileStats.filter((s): s is { path: string; atime: number } => s !== null);
            validStats.sort((a, b) => a.atime - b.atime); // Oldest first

            const toDelete = validStats.slice(0, files.length - FILE_COUNT_LIMIT);

            for (const file of toDelete) {
                try {
                    await fs.promises.unlink(file.path);
                } catch (error) {
                    log(`[Cleanup] Failed to prune ${file.path}: ${error}`);
                }
            }

            log(`[Cleanup] Pruned ${toDelete.length} files to enforce limit`);
        } catch (error) {
            log(`[Cleanup] File limit enforcement error: ${error}`);
        }
    }

    /**
     * Recursively list all files in a directory
     */
    private async listAllFiles(dir: string): Promise<string[]> {
        const result: string[] = [];
        const items = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                const subFiles = await this.listAllFiles(fullPath);
                result.push(...subFiles);
            } else {
                result.push(fullPath);
            }
        }

        return result;
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

async function unlinkIfExists(filePath: string): Promise<boolean> {
    try {
        await fs.promises.unlink(filePath);
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
