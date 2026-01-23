/**
 * MemoryManager - Core component of the Hierarchical Memory System
 */

import { MemoryLevel, MemoryEntry, MemorySnapshot, MemoryConfig } from "./interfaces.js";
import { log } from "../agents/logger.js";
import { MEMORY_CONSTANTS } from "../../shared/index.js";

export class MemoryManager {
    private static instance: MemoryManager;
    private memories: Map<string, MemoryLevel> = new Map(); // id -> level mapping
    private storage: MemorySnapshot = {
        [MemoryLevel.SYSTEM]: [],
        [MemoryLevel.PROJECT]: [],
        [MemoryLevel.MISSION]: [],
        [MemoryLevel.TASK]: [],
    };

    private config: MemoryConfig = {
        tokenBudgets: {
            [MemoryLevel.SYSTEM]: 2000,
            [MemoryLevel.PROJECT]: 5000,
            [MemoryLevel.MISSION]: 10000,
            [MemoryLevel.TASK]: 20000,
        },
        enableRelevanceFiltering: true,
    };

    private constructor() { }

    public static getInstance(): MemoryManager {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager();
        }
        return MemoryManager.instance;
    }

    /**
     * Add a memory entry
     */
    public add(level: MemoryLevel, content: string, importance: number = MEMORY_CONSTANTS.IMPORTANCE.NORMAL, metadata?: Record<string, any>): string {
        const id = `${MEMORY_CONSTANTS.ID_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const entry: MemoryEntry = {
            id,
            level,
            content: content.trim(),
            timestamp: Date.now(),
            importance,
            metadata,
        };

        this.storage[level].push(entry);
        this.memories.set(id, level);

        // Sort by importance and then timestamp
        this.storage[level].sort((a, b) => b.importance - a.importance || b.timestamp - a.timestamp);

        log(`[MemoryManager] Added ${level} memory: ${id.slice(0, 10)}...`);

        // Optional: Trigger pruning if budget exceeded
        this.prune(level);

        return id;
    }

    /**
     * Retrieve memory for prompt construction
     */
    public getContext(query?: string): string {
        let context = "";

        for (const level of [MemoryLevel.SYSTEM, MemoryLevel.PROJECT, MemoryLevel.MISSION, MemoryLevel.TASK]) {
            const entries = this.storage[level as MemoryLevel];
            if (entries.length === 0) continue;

            context += `\n### ${level.toUpperCase()} MEMORY\n`;

            // Simple relevance filtering (crude implementation for now)
            const filteredEntries = query && this.config.enableRelevanceFiltering
                ? entries.filter(e => this.isRelevant(e, query))
                : entries;

            for (const entry of filteredEntries) {
                context += `- [${new Date(entry.timestamp).toISOString()}] ${entry.content}\n`;
            }
        }

        return context.trim();
    }

    /**
     * Simple keyword-based relevance check
     */
    private isRelevant(entry: MemoryEntry, query: string): boolean {
        if (entry.importance > 0.8) return true; // High importance always relevant

        const q = query.toLowerCase();
        const content = entry.content.toLowerCase();
        const keywords = q.split(/\s+/).filter(k => k.length > 3);

        if (keywords.length === 0) return true;

        return keywords.some(k => content.includes(k));
    }

    /**
     * Prune memory based on token budget (simplified)
     */
    public prune(level: MemoryLevel): void {
        const budget = this.config.tokenBudgets[level];
        let currentSize = this.storage[level].reduce((acc, e) => acc + e.content.length / 4, 0); // Rough token estimate

        while (currentSize > budget && this.storage[level].length > 0) {
            // Remove the least important/oldest entry
            const removed = this.storage[level].pop();
            if (removed) {
                this.memories.delete(removed.id);
                currentSize -= removed.content.length / 4;
            }
        }
    }

    /**
     * Clear task memory (Short-term)
     */
    public clearTaskMemory(): void {
        for (const entry of this.storage[MemoryLevel.TASK]) {
            this.memories.delete(entry.id);
        }
        this.storage[MemoryLevel.TASK] = [];
        log("[MemoryManager] Task memory cleared.");
    }

    /**
     * Export full memory state (for persistence)
     */
    public export(): MemorySnapshot {
        return { ...this.storage };
    }

    /**
     * Import memory state
     */
    public import(snapshot: MemorySnapshot): void {
        this.storage = snapshot;
        this.memories.clear();
        for (const level of Object.values(MemoryLevel)) {
            for (const entry of this.storage[level as MemoryLevel]) {
                this.memories.set(entry.id, level as MemoryLevel);
            }
        }
    }
}
