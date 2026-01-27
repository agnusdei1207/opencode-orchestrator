/**
 * Generic Object Pool
 *
 * Reduces GC pressure by reusing objects instead of allocating new ones.
 * Target: 80% GC reduction, 60% memory usage reduction
 */

import type { Poolable } from "../../shared/core/index.js";

/**
 * Generic Object Pool
 */
export class ObjectPool<T extends Poolable> {
    private available: T[] = [];
    private inUse: Set<T> = new Set();
    private factory: () => T;
    private maxSize: number;
    private created: number = 0;

    // Statistics
    private stats = {
        acquires: 0,
        releases: 0,
        hits: 0,      // Reused from pool
        misses: 0,    // Created new
        disposed: 0   // Thrown away when pool full
    };

    constructor(
        factory: () => T,
        maxSize: number = 200
    ) {
        this.factory = factory;
        this.maxSize = maxSize;
    }

    /**
     * Acquire an object from the pool
     * Reuses existing or creates new if needed
     */
    acquire(): T {
        this.stats.acquires++;

        let obj = this.available.pop();

        if (obj) {
            // Hit - reused from pool
            this.stats.hits++;
        } else {
            // Miss - create new
            obj = this.factory();
            this.created++;
            this.stats.misses++;
        }

        this.inUse.add(obj);
        return obj;
    }

    /**
     * Release an object back to the pool
     * Object is reset and made available for reuse
     */
    release(obj: T): void {
        if (!this.inUse.has(obj)) {
            // Already released or never acquired
            return;
        }

        this.stats.releases++;
        this.inUse.delete(obj);

        // Reset for reuse
        try {
            obj.reset();
        } catch (err) {
            // If reset fails, don't return to pool
            return;
        }

        // Only return to pool if under max size
        if (this.available.length < this.maxSize) {
            this.available.push(obj);
        } else {
            // Pool is full, let GC collect it
            this.stats.disposed++;
        }
    }

    /**
     * Get pool statistics
     */
    getStats(): {
        created: number;
        available: number;
        inUse: number;
        acquires: number;
        releases: number;
        hits: number;
        misses: number;
        disposed: number;
        hitRate: number;
    } {
        const hitRate = this.stats.acquires > 0
            ? (this.stats.hits / this.stats.acquires) * 100
            : 0;

        return {
            created: this.created,
            available: this.available.length,
            inUse: this.inUse.size,
            acquires: this.stats.acquires,
            releases: this.stats.releases,
            hits: this.stats.hits,
            misses: this.stats.misses,
            disposed: this.stats.disposed,
            hitRate: Math.round(hitRate * 100) / 100
        };
    }

    /**
     * Clear the pool
     */
    clear(): void {
        this.available = [];
        this.inUse.clear();
    }

    /**
     * Prewarm the pool with N objects
     */
    prewarm(count: number): void {
        for (let i = 0; i < count && this.available.length < this.maxSize; i++) {
            const obj = this.factory();
            this.created++;
            this.available.push(obj);
        }
    }
}
