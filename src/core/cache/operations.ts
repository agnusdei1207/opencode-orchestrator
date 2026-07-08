/**
 * Document Cache Operations
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { CACHE, PATHS } from "../../shared/index.js";
import { ensureCacheDir, urlToFilename, readMetadata, writeMetadata, type CacheDocumentEntry } from "./utils.js";
import { log } from "../agents/logger.js";

export interface CachedDocument extends CacheDocumentEntry {
    content: string;
}

export interface CacheListEntry extends CacheDocumentEntry {
    filename: string;
    expired: boolean;
}

export interface CacheStats {
    totalDocuments: number;
    totalSize: number;
    expiredCount: number;
    oldestDocument: string | null;
    newestDocument: string | null;
}

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
        const filepath = path.join(PATHS.DOCS, filename);
        const content = await fs.readFile(filepath, "utf-8");
        return { ...entry, content };
    } catch (error) {
        log(`[DocumentCache] Failed to read cached document ${filename}: ${error}`);
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
        const filepath = path.join(PATHS.DOCS, filename);
        const content = await fs.readFile(filepath, "utf-8");
        return { ...entry, content };
    } catch (error) {
        log(`[DocumentCache] Failed to read cached document ${filename}: ${error}`);
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
    ttlMs: number = CACHE.DEFAULT_TTL_MS
): Promise<string> {
    await ensureCacheDir();

    const filename = urlToFilename(url);
    const filepath = path.join(PATHS.DOCS, filename);
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
    const filepath = path.join(PATHS.DOCS, filename);
    let removedFile = false;

    try {
        await fs.unlink(filepath);
        removedFile = true;
    } catch (error) {
        if (!isNotFoundError(error)) {
            log(`[DocumentCache] Failed to remove cached document ${filename}: ${error}`);
        }
    }

    const metadata = await readMetadata();
    const hadMetadata = Object.hasOwn(metadata.documents, filename);
    if (hadMetadata) {
        delete metadata.documents[filename];
        await writeMetadata(metadata);
    }

    if (!removedFile && !hadMetadata) {
        return false;
    }
    return true;
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
        const filepath = path.join(PATHS.DOCS, filename);
        try {
            await fs.unlink(filepath);
        } catch (error) {
            log(`[DocumentCache] Failed to delete cached document ${filename}: ${error}`);
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
            if (await remove(doc.url)) cleaned++;
        }
    }

    return cleaned;
}

function isNotFoundError(error: unknown): boolean {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && (error as { code?: unknown }).code === "ENOENT";
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
