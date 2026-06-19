import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { GraphParser } from "./graph-parser.js";
import { HybridSearch } from "./hybrid-search.js";
import { TagIndexer } from "./tag-indexer.js";
import { weightsForRole } from "./retrieval-weights.js";

const MAX_RESULTS = 3;
const MAX_SNIPPET_CHARS = 220;
const KNOWLEDGE_ROOTS = ["docs", path.join(".opencode", "docs")];
const SKIP_SEGMENTS = new Set(["node_modules", "dist", "bin", ".git", "archive"]);
const GENERATED_SCRATCHPAD_PATH = path.join(".opencode", "docs", "brain", "scratchpad.md");

interface IndexedKnowledge {
    search: HybridSearch;
    noteToPath: Map<string, string>;
    noteToSnippet: Map<string, string>;
}

export class KnowledgeContextProvider {
    public buildPrompt(directory: string, query: string, role?: string): string | null {
        const normalizedQuery = query.trim();
        if (!normalizedQuery) return null;

        const markdownFiles = this.collectMarkdownFiles(directory);
        if (markdownFiles.length === 0) return null;

        const indexed = this.indexKnowledge(directory, markdownFiles);
        // Role biases which retrieval engine dominates; omitting role is neutral.
        const results = indexed.search.search(normalizedQuery, MAX_RESULTS, weightsForRole(role));
        if (results.length === 0) return null;

        return this.formatPrompt(normalizedQuery, results, indexed);
    }

    private collectMarkdownFiles(directory: string): string[] {
        const files: string[] = [];
        for (const root of KNOWLEDGE_ROOTS) {
            const fullRoot = path.join(directory, root);
            if (!existsSync(fullRoot)) continue;
            files.push(...this.walkDirectory(fullRoot));
        }
        return files
            .filter(filePath => !this.isDirectInjectedScratchpad(directory, filePath))
            .sort();
    }

    private walkDirectory(directory: string): string[] {
        const files: string[] = [];
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                if (SKIP_SEGMENTS.has(entry.name)) continue;
                files.push(...this.walkDirectory(fullPath));
                continue;
            }

            if (entry.isFile() && entry.name.endsWith(".md")) {
                files.push(fullPath);
            }
        }
        return files;
    }

    private indexKnowledge(directory: string, files: string[]): IndexedKnowledge {
        const tagIndexer = new TagIndexer();
        const graphParser = new GraphParser();
        const search = new HybridSearch(tagIndexer, graphParser);
        const noteToPath = new Map<string, string>();
        const noteToSnippet = new Map<string, string>();

        for (const filePath of files) {
            try {
                const content = readFileSync(filePath, "utf8");
                const noteName = graphParser.getNoteName(filePath);
                const { body } = tagIndexer.parseFrontmatter(content);
                const normalizedBody = body.trim();

                tagIndexer.indexFile(filePath, content);
                graphParser.indexFile(filePath, content);
                search.indexContent(noteName, normalizedBody);
                noteToPath.set(noteName, path.relative(directory, filePath) || filePath);
                noteToSnippet.set(noteName, this.buildSnippet(normalizedBody));
            } catch {
                continue;
            }
        }

        return { search, noteToPath, noteToSnippet };
    }

    private buildSnippet(content: string): string {
        const normalized = content.replace(/\s+/g, " ").trim();
        if (normalized.length <= MAX_SNIPPET_CHARS) return normalized;
        return `${normalized.slice(0, MAX_SNIPPET_CHARS)}...`;
    }

    private isDirectInjectedScratchpad(directory: string, filePath: string): boolean {
        return path.relative(directory, filePath) === GENERATED_SCRATCHPAD_PATH;
    }

    private formatPrompt(
        query: string,
        results: Array<{ noteName: string; matchType: string }>,
        indexed: IndexedKnowledge,
    ): string {
        const lines = [
            "<knowledge_rag_context>",
            `Query: ${query}`,
            "Repository knowledge matches:",
            "",
        ];

        for (const [index, result] of results.entries()) {
            const filePath = indexed.noteToPath.get(result.noteName) ?? result.noteName;
            const snippet = indexed.noteToSnippet.get(result.noteName) ?? "";
            lines.push(`${index + 1}. ${result.noteName} [${result.matchType}]`);
            lines.push(`   Source: ${filePath}`);
            if (snippet) {
                lines.push(`   Snippet: ${snippet}`);
            }
        }

        lines.push("");
        lines.push("Use this as supplemental repository memory. Verify against source files before making claims.");
        lines.push("</knowledge_rag_context>");
        return lines.join("\n");
    }
}
