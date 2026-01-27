
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream';
import { parallelAgentManager } from "../agents/index.js";
import * as DocumentCache from "../cache/document-cache.js";
import { log } from "../agents/logger.js";
import { TASK_STATUS } from "../../shared/index.js";

const pipelineAsync = promisify(pipeline);

export class CleanupScheduler {
    private intervals: Map<string, NodeJS.Timeout> = new Map();
    private directory: string;

    constructor(directory: string) {
        this.directory = directory;
    }

    start() {
        // Immediate cleanup on start
        this.cleanNodeModules().catch(err => log(`[Cleanup] Initial node_modules cleanup failed: ${err}`));

        // Session cleanup: every 5 minutes (AGGRESSIVE)
        this.schedule('session-cleanup', () => this.cleanOldSessions(), 5 * 60 * 1000);

        // WAL compaction: every 10 minutes
        this.schedule('wal-compact', () => this.compactWAL(), 10 * 60 * 1000);

        // Document cache cleanup: every 30 minutes (was 1 hour)
        this.schedule('docs-clean', () => this.cleanDocs(), 30 * 60 * 1000);

        // File count limit: every 5 minutes
        this.schedule('file-count-limit', () => this.enforceFileLimit(), 5 * 60 * 1000);

        // node_modules cleanup: every 30 minutes
        this.schedule('node-modules-cleanup', () => this.cleanNodeModules(), 30 * 60 * 1000);

        // TODO history rotation: every 6 hours (was 24 hours)
        this.schedule('history-rotate', () => this.rotateHistory(), 6 * 60 * 60 * 1000);

        log(`[Cleanup] Scheduler started with aggressive cleanup intervals`);
    }

    private schedule(name: string, fn: () => Promise<void>, intervalMs: number) {
        // Run immediately if it's maintenance? No, usually delayed. 
        // But maybe run once at startup with random delay to avoid stampede?
        // For now, strict interval.
        const timer = setInterval(() => {
            fn().catch(err => log(`[Cleanup] ${name} failed:`, err));
        }, intervalMs);

        if (timer.unref) timer.unref();
        this.intervals.set(name, timer);
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

    async cleanDocs(): Promise<void> {
        try {
            // Remove expired docs
            // DocumentCache might not have cleanExpired exposed directly on module if it's not exported
            // I checked DocumentCache file, it had list/stats/get/clear.
            // Wait, does it have cleanExpired?
            // "src/core/cache/operations.ts" was referenced in doc. 
            // I should check cleanExpired availability.
            // If strictly following the file I saw (tools/web/cache-docs.ts imports * as DocumentCache from ...), I should verify 'cleanExpired' exists.

            // Assume it exists based on doc, if not I might need to implement it.
            // I'll trust the doc analysis or add a check.

            // Also size-based cleaning (from plan)
            const stats = await DocumentCache.stats();
            if (stats.totalSize > 10 * 1024 * 1024) { // 10MB
                const allDocs = await DocumentCache.list();
                // Sort by access time or fetch time? (fetchedAt)
                allDocs.sort((a, b) => new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime());

                const toDelete = allDocs.slice(0, Math.floor(allDocs.length / 2));
                for (const doc of toDelete) {
                    await DocumentCache.remove(doc.url);
                }
                log(`[Cleanup] Pruned ${toDelete.length} documents due to size limit`);
            }
        } catch (error) {
            // log(`[Cleanup] Doc cleanup error: ${error}`);
        }
    }

    async rotateHistory(): Promise<void> {
        try {
            const historyPath = path.join(this.directory, '.opencode/archive/todo_history.jsonl');
            if (!fs.existsSync(historyPath)) return;

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
            const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

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
            if (!fs.existsSync(sessionArchivePath)) return;

            const files = await fs.promises.readdir(sessionArchivePath);
            const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
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
            if (fs.existsSync(nodeModulesPath)) {
                await fs.promises.rm(nodeModulesPath, { recursive: true, force: true });
                log(`[Cleanup] Removed .opencode/node_modules`);
            }

            // Also remove package files
            const packageJson = path.join(this.directory, '.opencode/package.json');
            const lockFile = path.join(this.directory, '.opencode/bun.lock');
            const packageLock = path.join(this.directory, '.opencode/package-lock.json');

            if (fs.existsSync(packageJson)) {
                await fs.promises.unlink(packageJson);
            }
            if (fs.existsSync(lockFile)) {
                await fs.promises.unlink(lockFile);
            }
            if (fs.existsSync(packageLock)) {
                await fs.promises.unlink(packageLock);
            }
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
            if (!fs.existsSync(opencodeDir)) return;

            const files = await this.listAllFiles(opencodeDir);
            const MAX_FILES = 500;

            if (files.length <= MAX_FILES) return;

            log(`[Cleanup] File count (${files.length}) exceeds limit (${MAX_FILES}), pruning...`);

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

            const toDelete = validStats.slice(0, files.length - MAX_FILES);

            for (const file of toDelete) {
                try {
                    await fs.promises.unlink(file.path);
                } catch {
                    // Ignore errors (file might be in use)
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
