/**
 * Document Cache Utilities
 */

import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { CACHE_DIR, METADATA_FILE } from "./constants.js";
import type { CacheMetadata } from "./interfaces.js";

/**
 * Ensure cache directory exists
 */
export async function ensureCacheDir(): Promise<void> {
    if (!existsSync(CACHE_DIR)) {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    }
}

/**
 * Generate safe filename from URL
 */
export function urlToFilename(url: string): string {
    try {
        const parsed = new URL(url);
        const domain = parsed.hostname.replace(/\./g, "_");
        const pathPart = parsed.pathname
            .replace(/^\//, "")
            .replace(/\//g, "_")
            .replace(/[^a-zA-Z0-9_-]/g, "")
            .slice(0, 50);
        return `${domain}${pathPart ? "_" + pathPart : ""}.md`;
    } catch {
        return url.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60) + ".md";
    }
}

/**
 * Read cache metadata
 */
export async function readMetadata(): Promise<CacheMetadata> {
    try {
        const content = await fs.readFile(METADATA_FILE, "utf-8");
        return JSON.parse(content);
    } catch {
        return { documents: {}, lastUpdated: new Date().toISOString() };
    }
}

/**
 * Write cache metadata
 */
export async function writeMetadata(metadata: CacheMetadata): Promise<void> {
    await ensureCacheDir();
    metadata.lastUpdated = new Date().toISOString();
    await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2));
}
