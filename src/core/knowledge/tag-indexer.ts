import { readFileSync } from "node:fs";

/**
 * Interface representing standard Obsidian-style Frontmatter metadata.
 */
export interface FrontmatterData {
    tags?: string[];
    title?: string;
    keep?: boolean;
    [key: string]: unknown;
}

/**
 * Metadata extractor with regular expression fallback when standard parser crashes.
 */
export class TagIndexer {
    private tagMap: Map<string, Set<string>> = new Map();
    private fileCache: Map<string, FrontmatterData> = new Map();

    /**
     * Parse frontmatter using regular expressions as a primary safe parser.
     * This avoids library dependencies and provides deterministic error recovery.
     */
    public parseFrontmatter(content: string): { data: FrontmatterData; body: string } {
        const data: FrontmatterData = {};
        const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
        const match = content.match(frontmatterRegex);

        if (!match) {
            return { data, body: content };
        }

        const rawYaml = match[1];
        const body = content.replace(frontmatterRegex, "").trim();

        // Safe line-by-line parsing to prevent parser crash on bad indentation
        const lines = rawYaml.split(/\r?\n/);
        let activeKey: keyof FrontmatterData | null = null;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;

            const colonIdx = trimmed.indexOf(":");
            if (colonIdx !== -1) {
                const key = trimmed.slice(0, colonIdx).trim() as keyof FrontmatterData;
                const val = trimmed.slice(colonIdx + 1).trim();
                activeKey = key;

                if (val.startsWith("[") && val.endsWith("]")) {
                    // Match array format e.g., tags: [tag1, tag2]
                    data[key] = val
                        .slice(1, -1)
                        .split(",")
                        .map(s => s.trim())
                        .filter(Boolean);
                } else if (val) {
                    // Match scalar values
                    data[key] = this.parseScalar(val);
                } else {
                    data[key] = [];
                }
            } else if (trimmed.startsWith("-") && activeKey) {
                // Match block list format e.g.,
                // tags:
                //   - tag1
                const listVal = trimmed.slice(1).trim();
                if (listVal) {
                    const currentList = (data[activeKey] as unknown[]) || [];
                    currentList.push(listVal);
                    data[activeKey] = currentList as any;
                }
            }
        }

        return { data, body };
    }

    /**
     * Index a single markdown file content dynamically.
     */
    public indexFile(filePath: string, fileContent: string): void {
        this.clearIndexForFile(filePath);

        const { data } = this.parseFrontmatter(fileContent);
        this.fileCache.set(filePath, data);

        if (data.tags && Array.isArray(data.tags)) {
            for (const tag of data.tags) {
                if (typeof tag === "string") {
                    this.addTagEntry(tag.toLowerCase(), filePath);
                }
            }
        }
    }

    /**
     * Index a file directly from the filesystem.
     */
    public indexFileFromDisk(filePath: string): void {
        try {
            const content = readFileSync(filePath, "utf8");
            this.indexFile(filePath, content);
        } catch {
            // Graceful degradation if file cannot be read
            this.clearIndexForFile(filePath);
        }
    }

    /**
     * Get all files associated with a specific tag O(1).
     */
    public getFilesWithTag(tag: string): Set<string> {
        return this.tagMap.get(tag.toLowerCase()) || new Set<string>();
    }

    /**
     * Get intersection of files containing all specified tags.
     */
    public getFilesWithAllTags(tags: string[]): Set<string> {
        if (tags.length === 0) return new Set<string>();

        let result = new Set<string>(this.getFilesWithTag(tags[0]));
        for (let i = 1; i < tags.length; i++) {
            const currentSet = this.getFilesWithTag(tags[i]);
            result = new Set<string>([...result].filter(x => currentSet.has(x)));
        }
        return result;
    }

    /**
     * Get union of files containing any of the specified tags.
     */
    public getFilesWithAnyTags(tags: string[]): Set<string> {
        const result = new Set<string>();
        for (const tag of tags) {
            const files = this.getFilesWithTag(tag);
            for (const file of files) {
                result.add(file);
            }
        }
        return result;
    }

    /**
     * Get the cached frontmatter metadata of a file.
     */
    public getMetadata(filePath: string): FrontmatterData | undefined {
        return this.fileCache.get(filePath);
    }

    /**
     * Remove file references cleanly from tag mappings and metadata cache.
     */
    private clearIndexForFile(filePath: string): void {
        this.fileCache.delete(filePath);
        for (const [tag, files] of this.tagMap.entries()) {
            if (files.has(filePath)) {
                files.delete(filePath);
                if (files.size === 0) {
                    this.tagMap.delete(tag);
                }
            }
        }
    }

    /**
     * Helper to insert tags atomically.
     */
    private addTagEntry(tag: string, filePath: string): void {
        let files = this.tagMap.get(tag);
        if (!files) {
            files = new Set<string>();
            this.tagMap.set(tag, files);
        }
        files.add(filePath);
    }

    /**
     * Basic scalar value parser for YAML frontmatter fields.
     */
    private parseScalar(val: string): string | boolean | number {
        if (val === "true") return true;
        if (val === "false") return false;
        const num = Number(val);
        if (!isNaN(num)) return num;
        // Strip surround quotes if present
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            return val.slice(1, -1);
        }
        return val;
    }
}
