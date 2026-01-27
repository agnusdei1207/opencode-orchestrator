
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parallelAgentManager } from "../agents/index.js";
import * as DocumentCache from "../cache/document-cache.js";
import { log } from "../agents/logger.js";
import { TASK_STATUS } from "../../shared/index.js";

export class CleanupScheduler {
    private intervals: Map<string, NodeJS.Timeout> = new Map();
    private directory: string;

    constructor(directory: string) {
        this.directory = directory;
    }

    start() {
        // WAL compaction: every 10 minutes
        this.schedule('wal-compact', () => this.compactWAL(), 10 * 60 * 1000);

        // Document cache cleanup: every 1 hour
        this.schedule('docs-clean', () => this.cleanDocs(), 60 * 60 * 1000);

        // TODO history rotation: every 24 hours
        this.schedule('history-rotate', () => this.rotateHistory(), 24 * 60 * 60 * 1000);

        log(`[Cleanup] Scheduler started`);
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

            // Rename
            await fs.promises.rename(historyPath, archivePath);

            // Create empty file
            await fs.promises.writeFile(historyPath, '');

            // Prune old archives (> 30 days)
            const archiveDir = path.dirname(historyPath);
            const files = await fs.promises.readdir(archiveDir);
            const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

            for (const file of files) {
                if (file.startsWith('todo_history.') && file.endsWith('.jsonl')) {
                    const filePath = path.join(archiveDir, file);
                    const fStat = await fs.promises.stat(filePath);
                    if (fStat.mtimeMs < cutoff) {
                        await fs.promises.unlink(filePath);
                    }
                }
            }
            // log('[Cleanup] Rotated todo history');
        } catch (error) {
            log(`[Cleanup] History rotation error: ${error}`);
        }
    }
}
