/**
 * Document Cache Operations
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { CACHE_DIR, DEFAULT_TTL_MS } from "./constants.js";
import { ensureCacheDir, urlToFilename, readMetadata, writeMetadata } from "./utils.js";
import type { CachedDocument, CacheListEntry, CacheStats } from "./interfaces.js";

/**
 * Get cached document by URL
 */
export async function get(url: string): Promise<CachedDocument | null> {
    const metadata = await readMetadata();
    const filename = urlToFilename(url);
    const entry = metadata.documents[filename];

    if (!entry) return null;

    if (new Date(entry.expiresAt) < new Date()) {
        await remove(url);
        return null;
    }

    try {
        const filepath = path.join(CACHE_DIR, filename);
        const content = await fs.readFile(filepath, "utf-8");
        return { ...entry, content };
    } catch {
        return null;
    }
}

/**
 * Get cached document by filename
 */
export async function getByFilename(filename: string): Promise<CachedDocument | null> {
    const metadata = await readMetadata();
    const entry = metadata.documents[filename];

    if (!entry) return null;

    try {
        const filepath = path.join(CACHE_DIR, filename);
        const content = await fs.readFile(filepath, "utf-8");
        return { ...entry, content };
    } catch {
        return null;
    }
}

/**
 * Cache a document
 */
export async function set(
    url: string,
    content: string,
    title: string,
    ttlMs: number = DEFAULT_TTL_MS
): Promise<string> {
    await ensureCacheDir();

    const filename = urlToFilename(url);
    const filepath = path.join(CACHE_DIR, filename);
    const now = new Date();

    const header = `# ${title}\n\n> Source: ${url}\n> Cached: ${now.toISOString()}\n\n---\n\n`;
    const fullContent = header + content;
    await fs.writeFile(filepath, fullContent);

    const metadata = await readMetadata();
    metadata.documents[filename] = {
        url,
        title,
        fetchedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
        size: fullContent.length,
    };
    await writeMetadata(metadata);

    return filename;
}

/**
 * Remove cached document
 */
export async function remove(url: string): Promise<boolean> {
    const filename = urlToFilename(url);
    const filepath = path.join(CACHE_DIR, filename);

    try {
        await fs.unlink(filepath);
        const metadata = await readMetadata();
        delete metadata.documents[filename];
        await writeMetadata(metadata);
        return true;
    } catch {
        return false;
    }
}

/**
 * List all cached documents
 */
export async function list(): Promise<CacheListEntry[]> {
    const metadata = await readMetadata();
    const now = new Date();

    return Object.entries(metadata.documents).map(([filename, entry]) => ({
        filename,
        ...entry,
        expired: new Date(entry.expiresAt) < now,
    }));
}

/**
 * Clear all cached documents
 */
export async function clear(): Promise<number> {
    const metadata = await readMetadata();
    const count = Object.keys(metadata.documents).length;

    for (const filename of Object.keys(metadata.documents)) {
        const filepath = path.join(CACHE_DIR, filename);
        try {
            await fs.unlink(filepath);
        } catch {
            // Ignore
        }
    }

    await writeMetadata({ documents: {}, lastUpdated: new Date().toISOString() });
    return count;
}

/**
 * Clean expired documents
 */
export async function cleanExpired(): Promise<number> {
    const docs = await list();
    let cleaned = 0;

    for (const doc of docs) {
        if (doc.expired) {
            await remove(doc.url);
            cleaned++;
        }
    }

    return cleaned;
}

/**
 * Get cache statistics
 */
export async function stats(): Promise<CacheStats> {
    const docs = await list();

    if (docs.length === 0) {
        return {
            totalDocuments: 0,
            totalSize: 0,
            expiredCount: 0,
            oldestDocument: null,
            newestDocument: null,
        };
    }

    const sorted = docs.sort((a, b) =>
        new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime()
    );

    return {
        totalDocuments: docs.length,
        totalSize: docs.reduce((sum, d) => sum + d.size, 0),
        expiredCount: docs.filter(d => d.expired).length,
        oldestDocument: sorted[0]?.filename ?? null,
        newestDocument: sorted[sorted.length - 1]?.filename ?? null,
    };
}
