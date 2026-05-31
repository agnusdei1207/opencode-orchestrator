/**
 * Scratchpad - Volatile key-value register cache for agent working memory.
 * Implements LRU eviction and markdown-based serialization for persistence.
 */

/** Hard ceiling on register entries to bound memory usage. */
const MAX_ENTRIES = 64;
/** Per-entry size cap (4 KB) to prevent unbounded growth. */
const MAX_VALUE_BYTES = 4096;
/** Markdown header used as a sentinel during serialize/deserialize round-trips. */
const SERIALIZE_HEADER = "# Scratchpad Registers";
/** Regex to parse individual register blocks from serialized markdown. */
const REGISTER_REGEX = /^## (.+)\n\n([\s\S]*?)(?=\n## |\n*$)/gm;

export class Scratchpad {
    /**
     * Ordered map where the most-recently-accessed key moves to the end.
     * Eviction removes from the beginning (least recently used).
     */
    private registers: Map<string, string> = new Map();

    /**
     * Store a value, evicting the least-recently-used entry if at capacity.
     * Values exceeding 4 KB are truncated to enforce size constraints.
     */
    public set(key: string, value: string): void {
        // Remove-and-reinsert refreshes insertion order for LRU
        this.registers.delete(key);

        if (this.registers.size >= MAX_ENTRIES) {
            this.evictLru();
        }

        const truncated = value.length > MAX_VALUE_BYTES
            ? value.slice(0, MAX_VALUE_BYTES)
            : value;
        this.registers.set(key, truncated);
    }

    /**
     * Retrieve a register value, refreshing its LRU position on access.
     */
    public get(key: string): string | undefined {
        const value = this.registers.get(key);
        if (value === undefined) return undefined;

        // Refresh LRU position: delete and re-insert at the end
        this.registers.delete(key);
        this.registers.set(key, value);
        return value;
    }

    /** Return a snapshot copy of all registers. */
    public getAll(): Map<string, string> {
        return new Map(this.registers);
    }

    /** Remove a specific register entry. */
    public delete(key: string): boolean {
        return this.registers.delete(key);
    }

    /** Wipe all register entries. */
    public clear(): void {
        this.registers.clear();
    }

    /**
     * Export all registers as a markdown document for persistence.
     * Each register becomes a level-2 heading with its value as content.
     */
    public serialize(): string {
        const lines: string[] = [SERIALIZE_HEADER, ""];

        for (const [key, value] of this.registers) {
            lines.push(`## ${key}`, "", value, "");
        }

        return lines.join("\n").trimEnd() + "\n";
    }

    /**
     * Import registers from a previously serialized markdown document.
     * Clears existing state before importing to ensure idempotent loads.
     */
    public deserialize(content: string): void {
        this.registers.clear();

        const regex = new RegExp(REGISTER_REGEX.source, REGISTER_REGEX.flags);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
            const key = match[1].trim();
            const value = match[2].trim();
            if (key) {
                this.registers.set(key, value);
            }
        }
    }

    /** Evict the least-recently-used entry (first key in insertion order). */
    private evictLru(): void {
        const firstKey = this.registers.keys().next().value;
        if (firstKey !== undefined) {
            this.registers.delete(firstKey);
        }
    }
}
