/**
 * String Interning Pool
 *
 * Reduces memory by deduplicating identical strings.
 * Especially useful for repeated agent names, status values, etc.
 */

export class StringPool {
    private pool: Map<string, string> = new Map();
    private maxLength = 100; // Don't intern strings longer than this
    private maxSize = 1000;  // Max 1000 interned strings

    // Statistics
    private stats = {
        interns: 0,
        hits: 0,
        misses: 0,
        skipped: 0 // Too long
    };

    /**
     * Intern a string - returns the canonical instance
     * Type-safe version that preserves the input type
     */
    intern<T extends string>(str: T): T {
        this.stats.interns++;

        // Don't intern very long strings
        if (str.length > this.maxLength) {
            this.stats.skipped++;
            return str;
        }

        const existing = this.pool.get(str);
        if (existing) {
            // Hit - reuse existing
            this.stats.hits++;
            return existing as T;
        }

        // Miss - add to pool
        this.stats.misses++;

        // Evict oldest if pool is full (FIFO)
        if (this.pool.size >= this.maxSize) {
            const firstKey = this.pool.keys().next().value;
            if (firstKey) {
                this.pool.delete(firstKey);
            }
        }

        this.pool.set(str, str);
        return str;
    }

    /**
     * Get pool statistics
     */
    getStats(): {
        interns: number;
        hits: number;
        misses: number;
        skipped: number;
        hitRate: number;
        poolSize: number;
    } {
        const hitRate = this.stats.interns > 0
            ? (this.stats.hits / this.stats.interns) * 100
            : 0;

        return {
            interns: this.stats.interns,
            hits: this.stats.hits,
            misses: this.stats.misses,
            skipped: this.stats.skipped,
            hitRate: Math.round(hitRate * 100) / 100,
            poolSize: this.pool.size
        };
    }

    /**
     * Clear the pool
     */
    clear(): void {
        this.pool.clear();
    }

    /**
     * Prewarm with common strings
     */
    prewarm(strings: string[]): void {
        for (const str of strings) {
            if (str.length <= this.maxLength && this.pool.size < this.maxSize) {
                this.pool.set(str, str);
            }
        }
    }
}

/**
 * Global string pool
 */
export const stringPool = new StringPool();

// Prewarm with common values
stringPool.prewarm([
    // Agent names
    "commander",
    "planner",
    "worker",
    "reviewer",

    // Status values
    "pending",
    "running",
    "completed",
    "failed",
    "cancelled",

    // Common strings
    "error",
    "success",
    "timeout",
    "normal",
    "race",
    "fractal"
]);
