/**
 * GraphParser - Bi-directional Obsidian Wiki-Link & Markdown Link Knowledge Graph Parser
 */

export class GraphParser {
    // Maps note name -> set of target note names it links to
    private forwardLinks: Map<string, Set<string>> = new Map();
    // Maps note name -> set of source note names that link to it
    private backlinks: Map<string, Set<string>> = new Map();
    // Maps note name -> file path
    private noteToPath: Map<string, string> = new Map();
    // Maps file path -> note name
    private pathToNote: Map<string, string> = new Map();

    /**
     * Resolve file path or relative link to a note name (basename without extension).
     */
    public getNoteName(filePath: string): string {
        const basename = filePath.split(/[/\\]/).pop() || "";
        const dotIdx = basename.lastIndexOf(".");
        return dotIdx !== -1 ? basename.slice(0, dotIdx) : basename;
    }

    /**
     * Parse content and extract all unique referenced target note names.
     */
    public parseLinks(content: string): string[] {
        const targets: string[] = [];

        // 1. Parse Wiki-links: [[Note]], [[Note|Label]], [[Note#Section]]
        const wikiRegex = /\[\[([^[\]|#]+)(?:\|[^[\]]+)?(?:#[^[\]]+)?\]\]/g;
        let match;
        while ((match = wikiRegex.exec(content)) !== null) {
            const target = match[1].trim();
            if (target && !targets.includes(target)) {
                targets.push(target);
            }
        }

        // 2. Parse standard markdown links: [Label](./file.md), [Label](file.md)
        const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        while ((match = mdLinkRegex.exec(content)) !== null) {
            const url = match[2].trim();
            // Only extract local references
            if (!url.includes("://") && (url.endsWith(".md") || url.startsWith(".") || url.startsWith("/"))) {
                const targetName = this.getNoteName(url);
                if (targetName && !targets.includes(targetName)) {
                    targets.push(targetName);
                }
            }
        }

        return targets;
    }

    /**
     * Index file and register its bi-directional links.
     */
    public indexFile(filePath: string, content: string): void {
        const sourceNote = this.getNoteName(filePath);
        this.noteToPath.set(sourceNote, filePath);
        this.pathToNote.set(filePath, sourceNote);

        // Clear existing forward links for this note
        this.clearIndexForNote(sourceNote);

        // Parse and register new links
        const targets = this.parseLinks(content);

        if (targets.length > 0) {
            const forwardSet = new Set(targets);
            this.forwardLinks.set(sourceNote, forwardSet);

            for (const target of targets) {
                let backSet = this.backlinks.get(target);
                if (!backSet) {
                    backSet = new Set();
                    this.backlinks.set(target, backSet);
                }
                backSet.add(sourceNote);
            }
        }
    }

    /**
     * Retrieve backlinks for a note name or file path.
     */
    public getBacklinks(noteOrPath: string): string[] {
        const note = noteOrPath.includes("/") || noteOrPath.endsWith(".md")
            ? this.getNoteName(noteOrPath)
            : noteOrPath;
        const sources = this.backlinks.get(note);
        return sources ? Array.from(sources).sort() : [];
    }

    /**
     * Retrieve forward links for a note name or file path.
     */
    public getForwardLinks(noteOrPath: string): string[] {
        const note = noteOrPath.includes("/") || noteOrPath.endsWith(".md")
            ? this.getNoteName(noteOrPath)
            : noteOrPath;
        const targets = this.forwardLinks.get(note);
        return targets ? Array.from(targets).sort() : [];
    }

    /**
     * Synchronize the ## 🔗 Backlinks section in a file's content.
     */
    public syncBacklinksSection(content: string, backlinksList: string[]): string {
        const backlinksHeading = "## 🔗 Backlinks";
        const headingRegex = new RegExp(`(?:\\r?\\n|^)${backlinksHeading}\\b[\\s\\S]*$`);

        // Generate the new backlinks section
        let backlinksSectionContent = `\n\n${backlinksHeading}\n\n`;
        if (backlinksList.length > 0) {
            backlinksSectionContent += backlinksList.map(b => `- [[${b}]]`).join("\n");
        } else {
            backlinksSectionContent += "*(No backlinks found)*";
        }

        if (content.includes(backlinksHeading)) {
            // Replace the old section to the end of the file
            return content.replace(headingRegex, backlinksSectionContent);
        } else {
            // Append to the end of the file
            return content.trimEnd() + backlinksSectionContent;
        }
    }

    /**
     * Clear all indexes for a note.
     */
    private clearIndexForNote(sourceNote: string): void {
        const targets = this.forwardLinks.get(sourceNote);
        if (targets) {
            for (const target of targets) {
                const backSet = this.backlinks.get(target);
                if (backSet) {
                    backSet.delete(sourceNote);
                    if (backSet.size === 0) {
                        this.backlinks.delete(target);
                    }
                }
            }
            this.forwardLinks.delete(sourceNote);
        }
    }
}
