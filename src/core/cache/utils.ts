/**
 * Document Cache Utilities
 */

import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { PATHS } from "../../shared/index.js";
import { log } from "../agents/logger.js";

export interface CacheDocumentEntry {
    url: string;
    title: string;
    fetchedAt: string;
    expiresAt: string;
    size: number;
}

export interface CacheMetadata {
    documents: Record<string, CacheDocumentEntry>;
    lastUpdated: string;
}

function createEmptyMetadata(): CacheMetadata {
    return { documents: {}, lastUpdated: new Date().toISOString() };
}

/**
 * Ensure cache directory exists
 */
export async function ensureCacheDir(): Promise<void> {
    if (!existsSync(PATHS.DOCS)) {
        await fs.mkdir(PATHS.DOCS, { recursive: true });
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
    let content: string;
    try {
        content = await fs.readFile(PATHS.DOC_METADATA, "utf-8");
    } catch (error) {
        if (!isNotFoundError(error)) {
            log(`[DocumentCache] Failed to read cache metadata: ${error}`);
        }
        return createEmptyMetadata();
    }

    try {
        const parsed = JSON.parse(content);
        if (isCacheMetadata(parsed)) return parsed;
        log("[DocumentCache] Cache metadata has an invalid shape; using empty metadata");
    } catch (error) {
        log(`[DocumentCache] Failed to parse cache metadata: ${error}`);
    }

    return createEmptyMetadata();
}

/**
 * Write cache metadata
 */
export async function writeMetadata(metadata: CacheMetadata): Promise<void> {
    await ensureCacheDir();
    metadata.lastUpdated = new Date().toISOString();
    await fs.writeFile(PATHS.DOC_METADATA, JSON.stringify(metadata, null, 2));
}

function isCacheMetadata(value: unknown): value is CacheMetadata {
    if (!isRecord(value) || !isRecord(value.documents) || typeof value.lastUpdated !== "string") {
        return false;
    }

    return Object.values(value.documents).every(isCacheDocumentEntry);
}

function isCacheDocumentEntry(value: unknown): value is CacheDocumentEntry {
    return isRecord(value)
        && typeof value.url === "string"
        && typeof value.title === "string"
        && typeof value.fetchedAt === "string"
        && typeof value.expiresAt === "string"
        && typeof value.size === "number"
        && Number.isFinite(value.size);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNotFoundError(error: unknown): boolean {
    return isRecord(error) && error.code === "ENOENT";
}
