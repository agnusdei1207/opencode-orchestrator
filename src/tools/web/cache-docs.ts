/**
 * cache_docs Tool
 * 
 * Manage cached documentation
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import * as DocumentCache from "../../core/cache/document-cache.js";
import { CACHE_ACTIONS } from "../../shared/index.js";

export const cacheDocsTool: ToolDefinition = tool({
    description: `Manage cached documentation.

<usage>
- ${CACHE_ACTIONS.LIST}: Show all cached documents
- ${CACHE_ACTIONS.GET}: Retrieve a specific cached document
- ${CACHE_ACTIONS.CLEAR}: Clear all cached documents
- ${CACHE_ACTIONS.STATS}: Show cache statistics
</usage>

<examples>
cache_docs({ action: "${CACHE_ACTIONS.LIST}" })
cache_docs({ action: "${CACHE_ACTIONS.GET}", filename: "nextjs_app-router.md" })
cache_docs({ action: "${CACHE_ACTIONS.STATS}" })
cache_docs({ action: "${CACHE_ACTIONS.CLEAR}" })
</examples>`,
    args: {
        action: tool.schema.enum([
            CACHE_ACTIONS.LIST,
            CACHE_ACTIONS.GET,
            CACHE_ACTIONS.CLEAR,
            CACHE_ACTIONS.STATS
        ]).describe("Action to perform"),
        filename: tool.schema.string().optional().describe("Filename for 'get' action"),
    },
    async execute(args) {
        const { action, filename } = args;

        switch (action) {
            case CACHE_ACTIONS.LIST: {
                const docs = await DocumentCache.list();

                if (docs.length === 0) {
                    return `Document Cache: Empty\n\nNo documents cached yet. Use webfetch with cache: true to cache documents.`;
                }

                let output = `Document Cache (${docs.length} documents)\n\n`;

                for (const doc of docs) {
                    const status = doc.expired ? "EXPIRED" : "OK";
                    const size = doc.size > 1024
                        ? `${(doc.size / 1024).toFixed(1)}KB`
                        : `${doc.size}B`;
                    output += `[${status}] ${doc.filename} (${size})\n`;
                    output += `   Source: ${doc.url}\n`;
                    output += `   Cached: ${new Date(doc.fetchedAt).toLocaleString()}\n\n`;
                }

                return output;
            }

            case CACHE_ACTIONS.GET: {
                if (!filename) {
                    return `Error: Please specify filename to retrieve`;
                }

                const doc = await DocumentCache.getByFilename(filename);

                if (!doc) {
                    return `Document not found: ${filename}\n\nUse cache_docs({ action: "${CACHE_ACTIONS.LIST}" }) to see available documents.`;
                }

                return `${doc.title}\nSource: ${doc.url}\nCached: ${doc.fetchedAt}\n\n---\n\n${doc.content}`;
            }

            case CACHE_ACTIONS.CLEAR: {
                const count = await DocumentCache.clear();
                return `Cleared ${count} cached documents`;
            }

            case CACHE_ACTIONS.STATS: {
                const stats = await DocumentCache.stats();

                if (stats.totalDocuments === 0) {
                    return `Cache Statistics\n\nCache is empty.`;
                }

                const sizeStr = stats.totalSize > 1024 * 1024
                    ? `${(stats.totalSize / (1024 * 1024)).toFixed(2)}MB`
                    : stats.totalSize > 1024
                        ? `${(stats.totalSize / 1024).toFixed(1)}KB`
                        : `${stats.totalSize}B`;

                return `Cache Statistics

- Total Documents: ${stats.totalDocuments}
- Total Size: ${sizeStr}
- Expired: ${stats.expiredCount}
- Oldest: ${stats.oldestDocument || "N/A"}
- Newest: ${stats.newestDocument || "N/A"}`;
            }

            default:
                return `Unknown action: ${action}`;
        }
    },
});
