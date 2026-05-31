/**
 * SafetyGuards - Graph integrity checks and concurrency primitives.
 * Protects knowledge-graph mutations from cycles, races, and accidental deletes.
 */

import type { GraphParser } from "./graph-parser.js";
import type { FrontmatterData } from "./tag-indexer.js";

/** Default DFS depth limit to keep cycle detection bounded. */
const DEFAULT_MAX_DEPTH = 2;

/**
 * FIFO async write queue that serializes concurrent write operations
 * to prevent data corruption from overlapping file mutations.
 */
export interface WriteQueue {
    /** Enqueue a write operation; resolves when the operation completes. */
    enqueue(fn: () => Promise<void>): Promise<void>;
    /** Wait for all queued operations to finish. */
    drain(): Promise<void>;
}

export class SafetyGuards {
    /**
     * Detect circular links from a starting note via depth-limited DFS.
     * Returns true if the start note is reachable from itself within maxDepth hops.
     */
    public static checkCircularLinks(
        graph: GraphParser,
        startNote: string,
        maxDepth?: number,
    ): boolean {
        const limit = maxDepth ?? DEFAULT_MAX_DEPTH;
        const visited = new Set<string>();

        return SafetyGuards.dfsDetectCycle(
            graph, startNote, startNote, limit, visited,
        );
    }

    /**
     * Create a FIFO write queue that ensures only one write runs at a time.
     * Each enqueued function waits for all prior functions to complete first.
     */
    public static createWriteQueue(): WriteQueue {
        let tail: Promise<void> = Promise.resolve();
        const pending: Array<Promise<void>> = [];

        return {
            enqueue(fn: () => Promise<void>): Promise<void> {
                const task = tail.then(fn);
                tail = task.catch(() => {
                    /* Swallow to keep chain alive for subsequent writes. */
                });
                pending.push(task);
                return task;
            },

            async drain(): Promise<void> {
                await Promise.allSettled(pending);
                pending.length = 0;
            },
        };
    }

    /**
     * Check whether a note's frontmatter marks it as pinned (keep: true).
     * Pinned notes should be excluded from pruning and consolidation.
     */
    public static isPinned(metadata: FrontmatterData): boolean {
        return metadata.keep === true;
    }

    /**
     * Recursive DFS that returns true when the start note is revisited.
     * Bounded by maxDepth to prevent runaway traversal in dense graphs.
     * Always checks direct neighbors for the start note before applying depth limit.
     */
    private static dfsDetectCycle(
        graph: GraphParser,
        startNote: string,
        currentNote: string,
        remainingDepth: number,
        visited: Set<string>,
    ): boolean {
        const neighbors = graph.getForwardLinks(currentNote);
        for (const neighbor of neighbors) {
            if (neighbor === startNote) return true;
            if (remainingDepth <= 1) continue;
            if (visited.has(neighbor)) continue;

            visited.add(neighbor);
            const found = SafetyGuards.dfsDetectCycle(
                graph, startNote, neighbor, remainingDepth - 1, visited,
            );
            if (found) return true;
        }

        return false;
    }
}
