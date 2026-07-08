/**
 * Document Cache Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as DocumentCache from "../../src/core/cache/document-cache";
import { log } from "../../src/core/agents/logger.js";
import { PATHS } from "../../src/shared/index.js";

vi.mock("../../src/core/agents/logger.js", () => ({ log: vi.fn() }));

describe("DocumentCache", () => {
    const TEST_CACHE_DIR = ".opencode/docs";
    const TEST_URL = "https://example.com/docs/test-page";
    const TEST_CONTENT = "# Test Content\n\nThis is test documentation.";
    const TEST_TITLE = "Test Page";

    beforeEach(async () => {
        // Clean up before each test
        vi.clearAllMocks();
        await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
    });

    afterEach(async () => {
        // Clean up after each test
        await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
    });

    describe("set and get", () => {
        it("should cache a document and retrieve it", async () => {
            const filename = await DocumentCache.set(TEST_URL, TEST_CONTENT, TEST_TITLE);
            expect(filename).toBeTruthy();
            expect(filename.endsWith(".md")).toBe(true);

            const doc = await DocumentCache.get(TEST_URL);
            expect(doc).not.toBeNull();
            expect(doc?.url).toBe(TEST_URL);
            expect(doc?.title).toBe(TEST_TITLE);
            expect(doc?.content).toContain(TEST_CONTENT);
        });

        it("should return null for non-existent document", async () => {
            const doc = await DocumentCache.get("https://nonexistent.com/page");
            expect(doc).toBeNull();
        });
    });

    describe("list", () => {
        it("should list all cached documents", async () => {
            await DocumentCache.set("https://example.com/doc1", "Content 1", "Doc 1");
            await DocumentCache.set("https://example.com/doc2", "Content 2", "Doc 2");

            const docs = await DocumentCache.list();
            expect(docs.length).toBe(2);
        });

        it("should mark expired documents", async () => {
            // Set with very short TTL
            await DocumentCache.set(TEST_URL, TEST_CONTENT, TEST_TITLE, 1); // 1ms TTL

            // Wait for expiry
            await new Promise(r => setTimeout(r, 10));

            const docs = await DocumentCache.list();
            expect(docs.length).toBe(1);
            expect(docs[0].expired).toBe(true);
        });
    });

    describe("remove", () => {
        it("should remove a cached document", async () => {
            await DocumentCache.set(TEST_URL, TEST_CONTENT, TEST_TITLE);

            const removed = await DocumentCache.remove(TEST_URL);
            expect(removed).toBe(true);

            const doc = await DocumentCache.get(TEST_URL);
            expect(doc).toBeNull();
        });

        it("should return false for non-existent document", async () => {
            const removed = await DocumentCache.remove("https://nonexistent.com/page");
            expect(removed).toBe(false);
        });
    });

    describe("clear", () => {
        it("should clear all cached documents", async () => {
            await DocumentCache.set("https://example.com/doc1", "Content 1", "Doc 1");
            await DocumentCache.set("https://example.com/doc2", "Content 2", "Doc 2");

            const count = await DocumentCache.clear();
            expect(count).toBe(2);

            const docs = await DocumentCache.list();
            expect(docs.length).toBe(0);
        });
    });

    describe("cleanExpired", () => {
        it("should clean only expired documents", async () => {
            // Set with very short TTL
            await DocumentCache.set("https://example.com/expired", "Expired", "Expired Doc", 1);
            // Set with normal TTL
            await DocumentCache.set("https://example.com/valid", "Valid", "Valid Doc", 60000);

            // Wait for first to expire
            await new Promise(r => setTimeout(r, 10));

            const cleaned = await DocumentCache.cleanExpired();
            expect(cleaned).toBe(1);

            const docs = await DocumentCache.list();
            expect(docs.length).toBe(1);
            expect(docs[0].title).toBe("Valid Doc");
        });
    });

    describe("stats", () => {
        it("should return correct statistics", async () => {
            await DocumentCache.set("https://example.com/doc1", "Content 1", "Doc 1");
            await DocumentCache.set("https://example.com/doc2", "Content 2 longer content", "Doc 2");

            const stats = await DocumentCache.stats();

            expect(stats.totalDocuments).toBe(2);
            expect(stats.totalSize).toBeGreaterThan(0);
            expect(stats.expiredCount).toBe(0);
            expect(stats.oldestDocument).toBeTruthy();
            expect(stats.newestDocument).toBeTruthy();
        });

        it("should return empty stats for empty cache", async () => {
            const stats = await DocumentCache.stats();

            expect(stats.totalDocuments).toBe(0);
            expect(stats.totalSize).toBe(0);
            expect(stats.oldestDocument).toBeNull();
        });
    });

    describe("getByFilename", () => {
        it("should retrieve document by filename", async () => {
            const filename = await DocumentCache.set(TEST_URL, TEST_CONTENT, TEST_TITLE);

            const doc = await DocumentCache.getByFilename(filename);
            expect(doc).not.toBeNull();
            expect(doc?.title).toBe(TEST_TITLE);
        });

        it("should return null for non-existent filename", async () => {
            const doc = await DocumentCache.getByFilename("nonexistent.md");
            expect(doc).toBeNull();
        });

        it("should log stale metadata entries when the document file is missing", async () => {
            const filename = "missing_doc.md";
            await fs.mkdir(PATHS.DOCS, { recursive: true });
            await fs.writeFile(PATHS.DOC_METADATA, JSON.stringify({
                documents: {
                    [filename]: {
                        url: "https://example.com/missing",
                        title: "Missing",
                        fetchedAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + 60_000).toISOString(),
                        size: 10,
                    },
                },
                lastUpdated: new Date().toISOString(),
            }));

            const doc = await DocumentCache.getByFilename(filename);

            expect(doc).toBeNull();
            expect(log).toHaveBeenCalledWith(expect.stringContaining("Failed to read cached document missing_doc.md"));
        });
    });

    describe("metadata recovery", () => {
        it("should log corrupted metadata before falling back to an empty cache", async () => {
            await fs.mkdir(PATHS.DOCS, { recursive: true });
            await fs.writeFile(PATHS.DOC_METADATA, "{not valid json");

            const docs = await DocumentCache.list();

            expect(docs).toEqual([]);
            expect(log).toHaveBeenCalledWith(expect.stringContaining("Failed to parse cache metadata"));
        });
    });
});
