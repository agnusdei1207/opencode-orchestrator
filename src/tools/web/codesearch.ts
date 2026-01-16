/**
 * Code Search Tool
 * 
 * Search open source code using grep.app
 * Useful for finding patterns and examples from verified repositories
 */

import { tool } from "@opencode-ai/plugin";

interface CodeSearchResult {
    repo: string;
    file: string;
    line: number;
    content: string;
    url: string;
}

/**
 * Search grep.app for code patterns
 */
async function searchGrepApp(query: string, options: {
    language?: string;
    repo?: string;
}): Promise<CodeSearchResult[]> {
    const params = new URLSearchParams({
        q: query,
        ...(options.language && { filter: `lang:${options.language}` }),
        ...(options.repo && { filter: `repo:${options.repo}` }),
    });

    const url = `https://grep.app/api/search?${params}`;

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; OpenCode-Orchestrator/1.0)",
                "Accept": "application/json",
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            return [];
        }

        const data = await response.json() as {
            hits?: {
                hits?: Array<{
                    repo?: { raw?: string };
                    path?: { raw?: string };
                    content?: { snippet?: string };
                    lineno?: number;
                }>;
            };
        };

        const results: CodeSearchResult[] = [];

        for (const hit of (data.hits?.hits || []).slice(0, 10)) {
            const repo = hit.repo?.raw || "";
            const file = hit.path?.raw || "";
            const line = hit.lineno || 0;
            const content = hit.content?.snippet?.replace(/<[^>]+>/g, "") || "";

            if (repo && file) {
                results.push({
                    repo,
                    file,
                    line,
                    content: content.slice(0, 200),
                    url: `https://github.com/${repo}/blob/main/${file}#L${line}`,
                });
            }
        }

        return results;
    } catch (error) {
        console.error("grep.app search error:", error);
        return [];
    }
}

/**
 * Search GitHub code (fallback)
 */
async function searchGitHub(query: string, options: {
    language?: string;
}): Promise<CodeSearchResult[]> {
    const params = new URLSearchParams({
        q: query + (options.language ? ` language:${options.language}` : ""),
        type: "code",
    });

    // Note: GitHub code search requires authentication for API
    // This is a simplified version that uses web scraping
    const url = `https://github.com/search?${params}`;

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept": "text/html",
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            return [];
        }

        const html = await response.text();
        const results: CodeSearchResult[] = [];

        // Parse results from HTML (simplified)
        const repoPattern = /href="\/([^"]+)\/blob\/([^"]+)"/g;
        let match;
        let count = 0;

        while ((match = repoPattern.exec(html)) !== null && count < 10) {
            const [, repoPath, filePath] = match;
            if (repoPath && filePath) {
                results.push({
                    repo: repoPath,
                    file: filePath,
                    line: 0,
                    content: "(Use webfetch for full content)",
                    url: `https://github.com/${repoPath}/blob/${filePath}`,
                });
                count++;
            }
        }

        return results;
    } catch (error) {
        console.error("GitHub search error:", error);
        return [];
    }
}

export const codesearchTool = tool({
    description: `Search open source code for patterns and examples.

<usage>
- Find real-world usage patterns from verified repositories
- Discover best practices from popular projects
- Verify API usage with actual examples
</usage>

<tips>
- Be specific with search queries
- Add language filter for better results
- Use for verification, not just discovery
</tips>

<examples>
codesearch({ query: "useEffect cleanup function", language: "typescript" })
codesearch({ query: "prisma middleware logging" })
codesearch({ query: "next.js middleware redirect", repo: "vercel/next.js" })
</examples>`,
    args: {
        query: tool.schema.string().describe("Code pattern to search for"),
        language: tool.schema.string().optional().describe("Programming language filter"),
        repo: tool.schema.string().optional().describe("Specific repository (owner/repo)"),
    },
    async execute(args) {
        const { query, language, repo } = args;

        // Try grep.app first, then GitHub
        let results = await searchGrepApp(query, { language, repo });

        if (results.length === 0) {
            results = await searchGitHub(query, { language });
        }

        if (results.length === 0) {
            return `🔍 No code results found for: "${query}"

Try:
- Different search terms
- Broader language filter
- Check spelling`;
        }

        let output = `🔍 **Code Search Results for: "${query}"**\n\n`;
        output += `Found ${results.length} results${language ? ` (${language})` : ""}\n\n---\n\n`;

        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            output += `### ${i + 1}. ${r.repo}\n`;
            output += `📄 \`${r.file}\`${r.line ? `:${r.line}` : ""}\n`;
            output += `🔗 [View on GitHub](${r.url})\n\n`;
            if (r.content && r.content !== "(Use webfetch for full content)") {
                output += `\`\`\`\n${r.content}\n\`\`\`\n\n`;
            }
        }

        output += `---\n\n`;
        output += `💡 **Tip**: Use \`webfetch\` to get the full file content from any of these URLs.`;

        return output;
    },
});
