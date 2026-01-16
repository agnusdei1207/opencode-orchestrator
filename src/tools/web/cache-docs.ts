/**
 * cache_docs Tool
 * 
 * Manage cached documentation
 */

import { tool } from "@opencode-ai/plugin";
import * as DocumentCache from "../../core/cache/document-cache.js";

export const cacheDocsTool = tool({
    description: `Manage cached documentation.

<usage>
- list: Show all cached documents
- get: Retrieve a specific cached document
- clear: Clear all cached documents
- stats: Show cache statistics
</usage>

<examples>
cache_docs({ action: "list" })
cache_docs({ action: "get", filename: "nextjs_app-router.md" })
cache_docs({ action: "stats" })
cache_docs({ action: "clear" })
</examples>`,
    args: {
        action: tool.schema.enum(["list", "get", "clear", "stats"]).describe("Action to perform"),
        filename: tool.schema.string().optional().describe("Filename for 'get' action"),
    },
    async execute(args) {
        const { action, filename } = args;

        switch (action) {
            case "list": {
                const docs = await DocumentCache.list();

                if (docs.length === 0) {
                    return "📚 **Document Cache**: Empty\n\nNo documents cached yet. Use `webfetch` with `cache: true` to cache documents.";
                }

                let output = `📚 **Document Cache** (${docs.length} documents)\n\n`;

                for (const doc of docs) {
                    const status = doc.expired ? "⚠️ EXPIRED" : "✅";
                    const size = doc.size > 1024
                        ? `${(doc.size / 1024).toFixed(1)}KB`
                        : `${doc.size}B`;
                    output += `${status} **${doc.filename}** (${size})\n`;
                    output += `   Source: ${doc.url}\n`;
                    output += `   Cached: ${new Date(doc.fetchedAt).toLocaleString()}\n\n`;
                }

                return output;
            }

            case "get": {
                if (!filename) {
                    return "❌ Please specify `filename` to retrieve";
                }

                const doc = await DocumentCache.getByFilename(filename);

                if (!doc) {
                    return `❌ Document not found: ${filename}\n\nUse \`cache_docs({ action: "list" })\` to see available documents.`;
                }

                return `📚 **${doc.title}**\nSource: ${doc.url}\nCached: ${doc.fetchedAt}\n\n---\n\n${doc.content}`;
            }

            case "clear": {
                const count = await DocumentCache.clear();
                return `🗑️ Cleared ${count} cached documents`;
            }

            case "stats": {
                const stats = await DocumentCache.stats();

                if (stats.totalDocuments === 0) {
                    return "📊 **Cache Statistics**\n\nCache is empty.";
                }

                const sizeStr = stats.totalSize > 1024 * 1024
                    ? `${(stats.totalSize / (1024 * 1024)).toFixed(2)}MB`
                    : stats.totalSize > 1024
                        ? `${(stats.totalSize / 1024).toFixed(1)}KB`
                        : `${stats.totalSize}B`;

                return `📊 **Cache Statistics**

- Total Documents: ${stats.totalDocuments}
- Total Size: ${sizeStr}
- Expired: ${stats.expiredCount}
- Oldest: ${stats.oldestDocument || "N/A"}
- Newest: ${stats.newestDocument || "N/A"}`;
            }

            default:
                return `❌ Unknown action: ${action}`;
        }
    },
});
