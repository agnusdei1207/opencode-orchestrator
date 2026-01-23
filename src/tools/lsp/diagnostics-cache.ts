import fs from "fs/promises";
import path from "path";
import { log } from "../../core/agents/logger.js";

export interface CachedDiagnostics {
    diagnostics: any;
    timestamp: number;
    filesMtime: number;
}

export class DiagnosticsCache {
    private cache = new Map<string, CachedDiagnostics>();
    private defaultTTL = 30_000; // 30 seconds

    async get(directory: string, file?: string): Promise<any | null> {
        const key = this.getCacheKey(directory, file);
        const cached = this.cache.get(key);

        if (!cached) return null;

        // Check TTL
        if (Date.now() - cached.timestamp > this.defaultTTL) {
            this.cache.delete(key);
            return null;
        }

        // Check file modification time
        try {
            const currentMtime = await this.getFilesMtime(directory, file);
            if (currentMtime > cached.filesMtime) {
                this.cache.delete(key);
                return null;
            }
        } catch (error) {
            // If file doesn't exist anymore, invalidate cache
            this.cache.delete(key);
            return null;
        }

        log(`[DiagnosticsCache] Cache hit for ${file || "all files"}`);
        return cached.diagnostics;
    }

    async set(
        directory: string,
        file: string | undefined,
        diagnostics: any
    ) {
        try {
            const key = this.getCacheKey(directory, file);
            const filesMtime = await this.getFilesMtime(directory, file);

            this.cache.set(key, {
                diagnostics,
                timestamp: Date.now(),
                filesMtime,
            });
        } catch (error) {
            // Ignore mtime errors for setting cache
        }
    }

    private getCacheKey(directory: string, file?: string): string {
        return file ? `${directory}:${file}` : directory;
    }

    private async getFilesMtime(directory: string, file?: string): Promise<number> {
        if (file && file !== "*") {
            const stats = await fs.stat(path.join(directory, file));
            return stats.mtimeMs;
        }

        // For all files, check the directory mtime (shallow check)
        // or we could recursively check but that's expensive.
        // Let's at least check the directory itself.
        const stats = await fs.stat(directory);
        return stats.mtimeMs;
    }
}

export const diagnosticsCache = new DiagnosticsCache();
