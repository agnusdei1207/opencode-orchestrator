/**
 * webfetch Tool
 * 
 * Fetches content from a URL and converts HTML to Markdown
 * Used by Planner and Worker agents for documentation research
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import * as DocumentCache from "../../core/cache/document-cache.js";
import { PATHS, OUTPUT_LABEL } from "../../shared/index.js";

// Simple HTML to Markdown converter
function htmlToMarkdown(html: string): string {
    return html
        // Remove scripts and styles
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        // Convert headers
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
        .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n")
        .replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n")
        .replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n")
        // Convert paragraphs
        .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
        // Convert code blocks
        .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "```\n$1\n```\n\n")
        .replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`")
        // Convert lists
        .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
        .replace(/<ul[^>]*>/gi, "\n")
        .replace(/<\/ul>/gi, "\n")
        .replace(/<ol[^>]*>/gi, "\n")
        .replace(/<\/ol>/gi, "\n")
        // Convert links
        .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
        // Convert bold and italic
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
        .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
        .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
        .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
        // Convert blockquotes
        .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, "> $1\n\n")
        // Convert line breaks
        .replace(/<br\s*\/?>/gi, "\n")
        // Remove remaining HTML tags
        .replace(/<[^>]+>/g, "")
        // Decode HTML entities
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        // Clean up whitespace
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

// Extract title from HTML
function extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
    return match ? match[1].trim() : "Untitled";
}

// Extract main content (attempt to find article/main content)
function extractMainContent(html: string): string {
    // Try to find main content areas
    const patterns = [
        /<article[^>]*>([\s\S]*?)<\/article>/i,
        /<main[^>]*>([\s\S]*?)<\/main>/i,
        /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
            return match[1];
        }
    }

    // Fall back to body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : html;
}

export const webfetchTool: ToolDefinition = tool({
    description: `Fetch content from a URL and convert to markdown.

<usage>
- Fetches web pages and converts HTML to readable markdown
- Automatically caches content for future reference
- Use for documentation, API references, blog posts
</usage>

<examples>
webfetch({ url: "https://nextjs.org/docs/app/building-your-application" })
webfetch({ url: "https://react.dev/reference/react/useEffect", cache: true })
</examples>`,
    args: {
        url: tool.schema.string().describe("URL to fetch"),
        cache: tool.schema.boolean().optional().describe("Cache the result (default: true)"),
        selector: tool.schema.string().optional().describe("CSS selector to extract specific content (not implemented yet)"),
    },
    async execute(args) {
        const { url, cache = true } = args;

        // Check cache first
        if (cache) {
            const cached = await DocumentCache.get(url);
            if (cached) {
                return `${OUTPUT_LABEL.CACHED} (fetched: ${cached.fetchedAt})\n\n${cached.content}`;
            }
        }

        try {
            // Fetch the URL
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; OpenCode-Orchestrator/1.0)",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
                signal: AbortSignal.timeout(30000), // 30 second timeout
            });

            if (!response.ok) {
                return `Failed to fetch: HTTP ${response.status} ${response.statusText}`;
            }

            const contentType = response.headers.get("content-type") || "";
            const html = await response.text();

            // Handle non-HTML content
            if (contentType.includes("application/json")) {
                const content = JSON.stringify(JSON.parse(html), null, 2);
                if (cache) {
                    const filename = await DocumentCache.set(url, content, "JSON Response");
                    return `${OUTPUT_LABEL.JSON_FETCHED} (cached: ${PATHS.DOCS}/${filename})\n\n\`\`\`json\n${content.slice(0, 5000)}\n\`\`\``;
                }
                return `${OUTPUT_LABEL.JSON_FETCHED}\n\n\`\`\`json\n${content.slice(0, 5000)}\n\`\`\``;
            }

            if (contentType.includes("text/plain")) {
                if (cache) {
                    const filename = await DocumentCache.set(url, html, "Plain Text");
                    return `${OUTPUT_LABEL.TEXT_FETCHED} (cached: ${PATHS.DOCS}/${filename})\n\n${html.slice(0, 10000)}`;
                }
                return `${OUTPUT_LABEL.TEXT_FETCHED}\n\n${html.slice(0, 10000)}`;
            }

            // Process HTML
            const title = extractTitle(html);
            const mainContent = extractMainContent(html);
            const markdown = htmlToMarkdown(mainContent);

            // Limit content length
            const truncated = markdown.length > 15000
                ? markdown.slice(0, 15000) + "\n\n... [Content truncated]"
                : markdown;

            // Cache if requested
            if (cache) {
                const filename = await DocumentCache.set(url, truncated, title);
                return `[${title}]\nSource: ${url}\nCached: ${PATHS.DOCS}/${filename}\n\n---\n\n${truncated}`;
            }

            return `[${title}]\nSource: ${url}\n\n---\n\n${truncated}`;

        } catch (error) {
            if (error instanceof Error) {
                if (error.name === "TimeoutError") {
                    return `${OUTPUT_LABEL.TIMEOUT} Request timed out after 30 seconds`;
                }
                return `${OUTPUT_LABEL.ERROR} Fetch error: ${error.message}`;
            }
            return `${OUTPUT_LABEL.ERROR} Unknown error occurred`;
        }

    },
});
