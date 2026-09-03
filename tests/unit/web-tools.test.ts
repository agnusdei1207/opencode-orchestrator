import { describe, it, expect, vi, beforeEach } from "vitest";
import { webfetchTool } from "../../src/tools/web/webfetch.js";
import { websearchTool } from "../../src/tools/web/websearch.js";
import { codesearchTool } from "../../src/tools/web/codesearch.js";
import { cacheDocsTool } from "../../src/tools/web/cache-docs.js";
import * as DocumentCache from "../../src/core/cache/document-cache.js";
import { OUTPUT_LABEL, CACHE_ACTIONS } from "../../src/shared/index.js";

describe("Web Tools Suite", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe("webfetch", () => {
        it("returns cached content if present and cache is true", async () => {
            vi.spyOn(DocumentCache, "get").mockResolvedValue({
                url: "https://example.com/doc",
                content: "# Cached Title\nCached body",
                fetchedAt: "2026-09-04T00:00:00.000Z",
                filename: "doc.md",
                title: "Cached Title",
                size: 30,
            });

            const result = await (webfetchTool as any).execute({
                url: "https://example.com/doc",
                cache: true,
            });

            expect(result).toContain(OUTPUT_LABEL.CACHED);
            expect(result).toContain("Cached Title");
        });

        it("fetches and parses HTML into markdown", async () => {
            vi.spyOn(DocumentCache, "get").mockResolvedValue(null);
            vi.spyOn(DocumentCache, "set").mockResolvedValue("doc.md");

            const fakeHtml = `
                <html>
                    <head><title>Test Page</title></head>
                    <body>
                        <article>
                            <h1>Heading 1</h1>
                            <p>This is a <b>bold</b> test with <a href="https://example.com">link</a>.</p>
                            <pre><code>console.log('hello');</code></pre>
                            <ul><li>Item 1</li></ul>
                        </article>
                    </body>
                </html>
            `;

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                headers: new Headers({ "content-type": "text/html" }),
                text: vi.fn().mockResolvedValue(fakeHtml),
            });

            const result = await (webfetchTool as any).execute({
                url: "https://example.com/test",
                cache: true,
            });

            expect(result).toContain("[Test Page]");
            expect(result).toContain("# Heading 1");
            expect(result).toContain("**bold**");
            expect(result).toContain("[link](https://example.com)");
            expect(result).toContain("console.log('hello');");
            expect(result).toContain("- Item 1");
        });

        it("fetches and handles JSON responses", async () => {
            vi.spyOn(DocumentCache, "get").mockResolvedValue(null);
            vi.spyOn(DocumentCache, "set").mockResolvedValue("data.json");

            const fakeJson = JSON.stringify({ status: "ok", count: 42 });

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                headers: new Headers({ "content-type": "application/json" }),
                text: vi.fn().mockResolvedValue(fakeJson),
            });

            const result = await (webfetchTool as any).execute({
                url: "https://example.com/api",
                cache: true,
            });

            expect(result).toContain(OUTPUT_LABEL.JSON_FETCHED);
            expect(result).toContain('"count": 42');
        });

        it("fetches and handles plain text responses", async () => {
            vi.spyOn(DocumentCache, "get").mockResolvedValue(null);
            vi.spyOn(DocumentCache, "set").mockResolvedValue("text.txt");

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                headers: new Headers({ "content-type": "text/plain" }),
                text: vi.fn().mockResolvedValue("Plain content line"),
            });

            const result = await (webfetchTool as any).execute({
                url: "https://example.com/file.txt",
                cache: true,
            });

            expect(result).toContain(OUTPUT_LABEL.TEXT_FETCHED);
            expect(result).toContain("Plain content line");
        });

        it("handles HTTP error status", async () => {
            vi.spyOn(DocumentCache, "get").mockResolvedValue(null);

            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
                statusText: "Not Found",
            });

            const result = await (webfetchTool as any).execute({
                url: "https://example.com/notfound",
            });

            expect(result).toContain("Failed to fetch: HTTP 404 Not Found");
        });

        it("handles fetch timeout and network errors", async () => {
            vi.spyOn(DocumentCache, "get").mockResolvedValue(null);

            const timeoutErr = new Error("timeout");
            timeoutErr.name = "TimeoutError";
            global.fetch = vi.fn().mockRejectedValue(timeoutErr);

            const result = await (webfetchTool as any).execute({
                url: "https://example.com/hang",
            });

            expect(result).toContain(OUTPUT_LABEL.TIMEOUT);
        });
    });

    describe("websearch", () => {
        it("returns empty notice for empty query", async () => {
            const result = await (websearchTool as any).execute({ query: "" });
            expect(result).toContain("No results found for:");
        });

        it("searches via providers and formats markdown results", async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    results: [
                        {
                            title: "OpenCode Documentation",
                            url: "https://opencode.ai/docs",
                            content: "Official documentation for OpenCode.",
                            engine: "google",
                        },
                    ],
                }),
            });

            const result = await (websearchTool as any).execute({ query: "opencode docs" });
            expect(result).toContain("Web Search Results");
            expect(result).toContain("OpenCode Documentation");
            expect(result).toContain("https://opencode.ai/docs");
        });

        it("reports no results when providers return empty", async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
            });

            const result = await (websearchTool as any).execute({ query: "something very obscure" });
            expect(result).toContain("No results found");
        });
    });

    describe("codesearch", () => {
        it("searches grep.app with language and repo filters", async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    hits: {
                        hits: [
                            {
                                repo: { raw: "user/cool-repo" },
                                path: { raw: "src/main.ts" },
                                content: { snippet: "function run() { return true; }" },
                                lineno: 42,
                            },
                        ],
                    },
                }),
            });

            const result = await (codesearchTool as any).execute({
                query: "function run",
                language: "TypeScript",
                repo: "user/cool-repo",
            });

            expect(result).toContain("Code Search Results");
            expect(result).toContain("user/cool-repo");
            expect(result).toContain("src/main.ts");
            expect(result).toContain("42");
        });

        it("handles empty results and network failures in codesearch", async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
            });

            const result = await (codesearchTool as any).execute({ query: "unknown_fn_12345" });
            expect(result).toContain("No code results found for");
        });
    });

    describe("cache_docs", () => {
        it("handles LIST action on empty cache", async () => {
            vi.spyOn(DocumentCache, "list").mockResolvedValue([]);
            const result = await (cacheDocsTool as any).execute({ action: CACHE_ACTIONS.LIST });
            expect(result).toContain("Document Cache: Empty");
        });

        it("handles LIST action on populated cache", async () => {
            vi.spyOn(DocumentCache, "list").mockResolvedValue([
                {
                    filename: "react.md",
                    url: "https://react.dev",
                    title: "React",
                    fetchedAt: "2026-09-04T00:00:00.000Z",
                    size: 2048,
                    expired: false,
                },
            ]);

            const result = await (cacheDocsTool as any).execute({ action: CACHE_ACTIONS.LIST });
            expect(result).toContain("Document Cache (1 documents)");
            expect(result).toContain("react.md");
            expect(result).toContain("2.0KB");
        });

        it("handles GET action when found and not found", async () => {
            vi.spyOn(DocumentCache, "getByFilename").mockImplementation(async (f) => {
                if (f === "nextjs.md") {
                    return {
                        filename: "nextjs.md",
                        url: "https://nextjs.org",
                        title: "Next.js",
                        fetchedAt: "2026-09-04T00:00:00.000Z",
                        content: "# Next.js Content",
                        size: 100,
                    };
                }
                return null;
            });

            const missingFilenameResult = await (cacheDocsTool as any).execute({ action: CACHE_ACTIONS.GET });
            expect(missingFilenameResult).toContain("Please specify filename to retrieve");

            const foundResult = await (cacheDocsTool as any).execute({ action: CACHE_ACTIONS.GET, filename: "nextjs.md" });
            expect(foundResult).toContain("# Next.js Content");

            const notFoundResult = await (cacheDocsTool as any).execute({ action: CACHE_ACTIONS.GET, filename: "unknown.md" });
            expect(notFoundResult).toContain("Document not found");
        });

        it("handles CLEAR and STATS actions", async () => {
            vi.spyOn(DocumentCache, "clear").mockResolvedValue(5);
            vi.spyOn(DocumentCache, "stats").mockResolvedValue({
                totalDocuments: 10,
                totalSize: 50000,
                expiredCount: 2,
                oldestDocument: "old.md",
                newestDocument: "new.md",
            });

            const clearResult = await (cacheDocsTool as any).execute({ action: CACHE_ACTIONS.CLEAR });
            expect(clearResult).toContain("Cleared 5 cached documents");

            const statsResult = await (cacheDocsTool as any).execute({ action: CACHE_ACTIONS.STATS });
            expect(statsResult).toContain("Total Documents: 10");
            expect(statsResult).toContain("Expired: 2");

            vi.spyOn(DocumentCache, "stats").mockResolvedValue({
                totalDocuments: 0,
                totalSize: 0,
                expiredCount: 0,
                oldestDocument: null,
                newestDocument: null,
            });
            const emptyStatsResult = await (cacheDocsTool as any).execute({ action: CACHE_ACTIONS.STATS });
            expect(emptyStatsResult).toContain("Cache is empty");
        });
    });
});
