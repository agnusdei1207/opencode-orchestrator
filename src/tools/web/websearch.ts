/**
 * websearch Tool
 * 
 * Searches the web for information using multiple providers
 * Priority: SearXNG (local) > Brave Search > DuckDuckGo (fallback)
 */

import { tool } from "@opencode-ai/plugin";
import { OUTPUT_LABEL } from "../../shared/index.js";
import { log } from "../../core/agents/logger.js";

interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    source?: string;
}

// ============================================================================
// Search Providers
// ============================================================================

/**
 * SearXNG - Meta search engine (self-hosted, best quality)
 */
async function searchSearXNG(query: string): Promise<SearchResult[]> {
    // Try common SearXNG instances
    const instances = [
        "https://searxng.site",
        "https://search.bus-hit.me",
        "https://paulgo.io",
    ];

    for (const instance of instances) {
        try {
            const url = `${instance}/search?q=${encodeURIComponent(query)}&format=json&engines=google,duckduckgo,bing`;
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; OpenCode/1.0)",
                    "Accept": "application/json",
                },
                signal: AbortSignal.timeout(8000),
            });

            if (!response.ok) continue;

            const data = await response.json() as {
                results?: Array<{
                    title?: string;
                    url?: string;
                    content?: string;
                    engine?: string;
                }>;
            };

            if (data.results && data.results.length > 0) {
                return data.results.slice(0, 15).map(r => ({
                    title: r.title || "",
                    url: r.url || "",
                    snippet: r.content || "",
                    source: r.engine || "searxng",
                }));
            }
        } catch {
            continue;
        }
    }

    return [];
}

/**
 * Brave Search - Good quality, no API key for basic usage
 */
async function searchBrave(query: string): Promise<SearchResult[]> {
    const url = `https://search.brave.com/api/suggest?q=${encodeURIComponent(query)}`;

    try {
        // Brave web results via HTML parsing
        const webUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
        const response = await fetch(webUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept": "text/html",
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        const results: SearchResult[] = [];

        // Parse Brave Search HTML results
        // Look for data-type="web" results
        const snippetPattern = /<div class="snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
        const titlePattern = /<a[^>]*class="[^"]*result-header[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

        let match;
        const titles: string[] = [];
        const urls: string[] = [];
        const snippets: string[] = [];

        // Extract titles and URLs
        while ((match = titlePattern.exec(html)) !== null) {
            urls.push(match[1]);
            titles.push(match[2].replace(/<[^>]+>/g, "").trim());
        }

        // Extract snippets
        while ((match = snippetPattern.exec(html)) !== null) {
            const text = match[1].replace(/<[^>]+>/g, "").trim();
            if (text.length > 20) {
                snippets.push(text);
            }
        }

        // Combine results
        for (let i = 0; i < Math.min(titles.length, 10); i++) {
            if (titles[i] && urls[i]) {
                results.push({
                    title: titles[i],
                    url: urls[i],
                    snippet: snippets[i] || "",
                    source: "brave",
                });
            }
        }

        return results;
    } catch (error) {
        log("Brave search error:", error);
        return [];
    }
}

/**
 * DuckDuckGo Instant Answer API (fallback)
 */
async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; OpenCode-Orchestrator/1.0)",
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json() as {
            Abstract?: string;
            AbstractURL?: string;
            AbstractSource?: string;
            Heading?: string;
            RelatedTopics?: Array<{
                Text?: string;
                FirstURL?: string;
            }>;
            Results?: Array<{
                Text?: string;
                FirstURL?: string;
            }>;
        };

        const results: SearchResult[] = [];

        // Add abstract if available
        if (data.Abstract && data.AbstractURL) {
            results.push({
                title: data.Heading || data.AbstractSource || "Main Result",
                url: data.AbstractURL,
                snippet: data.Abstract,
                source: "duckduckgo",
            });
        }

        // Add related topics
        for (const topic of (data.RelatedTopics || []).slice(0, 8)) {
            if (topic.Text && topic.FirstURL) {
                results.push({
                    title: topic.Text.split(" - ")[0] || topic.Text.slice(0, 50),
                    url: topic.FirstURL,
                    snippet: topic.Text,
                    source: "duckduckgo",
                });
            }
        }

        // Add direct results
        for (const result of (data.Results || []).slice(0, 5)) {
            if (result.Text && result.FirstURL) {
                results.push({
                    title: result.Text.split(" - ")[0] || result.Text.slice(0, 50),
                    url: result.FirstURL,
                    snippet: result.Text,
                    source: "duckduckgo",
                });
            }
        }

        return results;
    } catch (error) {
        log("DuckDuckGo search error:", error);
        return [];
    }
}

/**
 * DuckDuckGo HTML Scraping (last resort)
 */
async function searchDuckDuckGoHtml(query: string): Promise<SearchResult[]> {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        const results: SearchResult[] = [];

        // Parse results from HTML
        const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gi;
        let match;

        while ((match = resultPattern.exec(html)) !== null && results.length < 10) {
            results.push({
                title: match[2].replace(/<[^>]+>/g, "").trim(),
                url: decodeURIComponent(match[1].replace(/.*uddg=/, "").split("&")[0] || match[1]),
                snippet: match[3].replace(/<[^>]+>/g, "").trim(),
                source: "duckduckgo_html",
            });
        }

        return results;
    } catch (error) {
        log("DuckDuckGo HTML search error:", error);
        return [];
    }
}

// ============================================================================
// Main Tool
// ============================================================================

export const websearchTool = tool({
    description: `Search the web for information using multiple search providers.

<usage>
- Uses SearXNG (meta-search) > Brave Search > DuckDuckGo
- Returns relevant results with URLs
- Use for finding documentation, tutorials, solutions
</usage>

<tips>
- Add "docs" or "documentation" for official docs
- Add "site:github.com" for GitHub results
- Add specific version numbers when relevant
- Add current year for latest information
</tips>

<examples>
websearch({ query: "Next.js 14 app router documentation" })
websearch({ query: "React useEffect cleanup best practices 2025" })
websearch({ query: "TypeScript generic constraints site:typescriptlang.org" })
</examples>`,
    args: {
        query: tool.schema.string().describe("Search query"),
        maxResults: tool.schema.number().optional().describe("Maximum number of results (default: 10)"),
    },
    async execute(args) {
        const { query, maxResults = 10 } = args;
        let results: SearchResult[] = [];
        let provider = "";

        // Try providers in order
        // 1. SearXNG (best quality - meta search)
        results = await searchSearXNG(query);
        if (results.length > 0) {
            provider = "SearXNG";
        }

        // 2. Brave Search
        if (results.length === 0) {
            results = await searchBrave(query);
            if (results.length > 0) {
                provider = "Brave";
            }
        }

        // 3. DuckDuckGo Instant Answer
        if (results.length === 0) {
            results = await searchDuckDuckGo(query);
            if (results.length > 0) {
                provider = "DuckDuckGo";
            }
        }

        // 4. DuckDuckGo HTML Scraping
        if (results.length === 0) {
            results = await searchDuckDuckGoHtml(query);
            if (results.length > 0) {
                provider = "DuckDuckGo HTML";
            }
        }

        if (results.length === 0) {
            return `No results found for: "${query}"

Try:
- Different keywords
- More specific terms
- Check spelling
- Add "docs" or "official" for documentation`;
        }

        // Format results
        const limitedResults = results.slice(0, maxResults);

        let output = `[Web Search Results for]: "${query}"\n\n`;
        output += `Provider: ${provider} | Found ${results.length} results (showing ${limitedResults.length})\n\n---\n\n`;

        for (let i = 0; i < limitedResults.length; i++) {
            const result = limitedResults[i];
            output += `### ${i + 1}. ${result.title}\n`;
            output += `URL: ${result.url}\n\n`;
            if (result.snippet) {
                output += `${result.snippet}\n\n`;
            }
        }

        output += `---\n\n`;
        output += `Tip: Use \`webfetch\` to get full content from any of these URLs.`;


        return output;
    },
});
