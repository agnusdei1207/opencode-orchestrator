/**
 * Buffer Pool
 *
 * Pools ArrayBuffers for efficient memory reuse.
 * Sizes: 1KB, 4KB, 16KB, 64KB
 */

export class BufferPool {
    private pools: Map<number, ArrayBuffer[]> = new Map();
    private readonly sizes = [1024, 4096, 16384, 65536]; // 1KB, 4KB, 16KB, 64KB
    private readonly maxPerSize = 50; // Max 50 buffers per size

    // Statistics
    private stats = {
        acquires: 0,
        releases: 0,
        hits: 0,
        misses: 0
    };

    constructor() {
        // Initialize pools
        for (const size of this.sizes) {
            this.pools.set(size, []);
        }
    }

    /**
     * Acquire a buffer of at least minSize
     * Returns the buffer and its actual size
     */
    acquire(minSize: number): { buffer: ArrayBuffer; poolSize: number } {
        this.stats.acquires++;

        // Find smallest buffer that fits
        const poolSize = this.sizes.find(s => s >= minSize) || this.sizes[this.sizes.length - 1];
        const pool = this.pools.get(poolSize)!;

        let buffer = pool.pop();

        if (buffer) {
            // Hit - reused from pool
            this.stats.hits++;
        } else {
            // Miss - create new
            buffer = new ArrayBuffer(poolSize);
            this.stats.misses++;
        }

        return { buffer, poolSize };
    }

    /**
     * Release a buffer back to the pool
     */
    release(buffer: ArrayBuffer): void {
        this.stats.releases++;

        const size = buffer.byteLength;
        const pool = this.pools.get(size);

        if (!pool) {
            // Not a pooled size
            return;
        }

        // Only return to pool if under max
        if (pool.length < this.maxPerSize) {
            pool.push(buffer);
        }
    }

    /**
     * Get pool statistics
     */
    getStats(): {
        acquires: number;
        releases: number;
        hits: number;
        misses: number;
        hitRate: number;
        poolSizes: Record<number, number>;
    } {
        const hitRate = this.stats.acquires > 0
            ? (this.stats.hits / this.stats.acquires) * 100
            : 0;

        const poolSizes: Record<number, number> = {};
        for (const [size, pool] of this.pools.entries()) {
            poolSizes[size] = pool.length;
        }

        return {
            acquires: this.stats.acquires,
            releases: this.stats.releases,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: Math.round(hitRate * 100) / 100,
            poolSizes
        };
    }

    /**
     * Clear all pools
     */
    clear(): void {
        for (const pool of this.pools.values()) {
            pool.length = 0;
        }
    }

    /**
     * Prewarm pools with buffers
     */
    prewarm(countPerSize: number = 10): void {
        for (const size of this.sizes) {
            const pool = this.pools.get(size)!;
            for (let i = 0; i < countPerSize && pool.length < this.maxPerSize; i++) {
                pool.push(new ArrayBuffer(size));
            }
        }
    }
}

/**
 * Global buffer pool
 */
export const bufferPool = new BufferPool();

// Prewarm with 10 buffers per size
bufferPool.prewarm(10);
