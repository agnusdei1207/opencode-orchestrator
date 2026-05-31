/**
 * MemoryConsolidation - Pure analysis functions for knowledge-graph maintenance.
 * All methods are side-effect-free: they read from indexes but never mutate state or files.
 */

import type { TagIndexer } from "./tag-indexer.js";
import type { GraphParser } from "./graph-parser.js";

/** Default line count threshold for oversized note detection. */
const DEFAULT_MAX_LINES = 500;
/** Minimum shared tag count to suggest a merge between two notes. */
const DEFAULT_MERGE_THRESHOLD = 3;

export class MemoryConsolidation {
    private readonly tagIndexer: TagIndexer;
    private readonly graphParser: GraphParser;

    constructor(tagIndexer: TagIndexer, graphParser: GraphParser) {
        this.tagIndexer = tagIndexer;
        this.graphParser = graphParser;
    }

    /**
     * Find notes whose content exceeds the line-count ceiling.
     * These are candidates for splitting to improve navigability.
     */
    public identifyOversizedNotes(
        contentMap: Map<string, string>,
        maxLines?: number,
    ): string[] {
        const limit = maxLines ?? DEFAULT_MAX_LINES;
        const oversized: string[] = [];

        for (const [name, content] of contentMap) {
            const lineCount = content.split("\n").length;
            if (lineCount > limit) {
                oversized.push(name);
            }
        }

        return oversized.sort();
    }

    /**
     * Find notes that have zero forward links AND zero backlinks.
     * Orphan notes are disconnected from the graph and may need linking or removal.
     */
    public identifyOrphanNotes(allNotes: string[]): string[] {
        const orphans: string[] = [];

        for (const note of allNotes) {
            const forward = this.graphParser.getForwardLinks(note);
            const back = this.graphParser.getBacklinks(note);
            if (forward.length === 0 && back.length === 0) {
                orphans.push(note);
            }
        }

        return orphans.sort();
    }

    /**
     * Find pairs of notes sharing enough tags to warrant merging.
     * Uses TagIndexer.getAllTags() and getFilesWithTag() to build the full picture.
     */
    public suggestMerges(threshold?: number): Array<[string, string]> {
        const minShared = threshold ?? DEFAULT_MERGE_THRESHOLD;
        const noteTagMap = this.buildNoteTagMap();
        const notes = Array.from(noteTagMap.keys()).sort();
        const pairs: Array<[string, string]> = [];

        for (let i = 0; i < notes.length; i++) {
            for (let j = i + 1; j < notes.length; j++) {
                const shared = this.countSharedTags(
                    noteTagMap.get(notes[i])!,
                    noteTagMap.get(notes[j])!,
                );
                if (shared >= minShared) {
                    pairs.push([notes[i], notes[j]]);
                }
            }
        }

        return pairs;
    }

    /**
     * Generate a Map of Content markdown listing all notes tagged with the given tag.
     * MOCs serve as navigational hubs in the knowledge graph.
     */
    public generateMOC(tag: string): string {
        const files = this.tagIndexer.getFilesWithTag(tag);
        const noteNames = Array.from(files)
            .map(f => this.graphParser.getNoteName(f))
            .sort();

        const lines: string[] = [
            `# MOC: ${tag}`,
            "",
            `> Map of Content for tag \`${tag}\``,
            "",
        ];

        if (noteNames.length === 0) {
            lines.push("*(No notes found with this tag)*");
        } else {
            for (const name of noteNames) {
                lines.push(`- [[${name}]]`);
            }
        }

        return lines.join("\n") + "\n";
    }

    /**
     * Build a lookup from note name to its set of tags by iterating
     * all known tags in the index and collecting their associated files.
     */
    private buildNoteTagMap(): Map<string, Set<string>> {
        const result = new Map<string, Set<string>>();
        const allTags = this.tagIndexer.getAllTags();

        for (const tag of allTags) {
            const files = this.tagIndexer.getFilesWithTag(tag);
            for (const file of files) {
                const noteName = this.graphParser.getNoteName(file);
                let tags = result.get(noteName);
                if (!tags) {
                    tags = new Set<string>();
                    result.set(noteName, tags);
                }
                tags.add(tag);
            }
        }

        return result;
    }

    /** Count how many tags two sets share. */
    private countSharedTags(a: Set<string>, b: Set<string>): number {
        let count = 0;
        for (const tag of a) {
            if (b.has(tag)) count++;
        }
        return count;
    }
}
