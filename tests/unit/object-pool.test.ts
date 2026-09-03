import { describe, it, expect, vi } from "vitest";
import { ObjectPool } from "../../src/core/pool/object-pool.js";
import { StringPool } from "../../src/core/pool/string-pool.js";
import type { Poolable } from "../../src/shared/core/index.js";

class TestItem implements Poolable {
    public value: number = 0;
    public resetCalled: boolean = false;

    reset(): void {
        this.value = 0;
        this.resetCalled = true;
    }
}

describe("Pool Subsystem", () => {
    describe("ObjectPool", () => {
        it("acquires, reuses, and tracks hit rate", () => {
            const pool = new ObjectPool<TestItem>(() => new TestItem(), 5);

            // First acquire is a miss
            const item1 = pool.acquire();
            expect(item1).toBeInstanceOf(TestItem);
            expect(pool.getStats().misses).toBe(1);
            expect(pool.getStats().hits).toBe(0);

            // Release back to pool
            item1.value = 42;
            pool.release(item1);
            expect(item1.value).toBe(0);
            expect(item1.resetCalled).toBe(true);
            expect(pool.getStats().available).toBe(1);

            // Second acquire is a hit
            const item2 = pool.acquire();
            expect(item2).toBe(item1);
            expect(pool.getStats().hits).toBe(1);
            expect(pool.getStats().hitRate).toBe(50); // 1 hit out of 2 acquires
        });

        it("disposes items when pool is full beyond maxSize", () => {
            const pool = new ObjectPool<TestItem>(() => new TestItem(), 1);

            const item1 = pool.acquire();
            const item2 = pool.acquire();

            pool.release(item1);
            pool.release(item2); // Pool already at max size 1 -> item2 disposed

            expect(pool.getStats().disposed).toBe(1);
            expect(pool.getStats().available).toBe(1);
        });

        it("prewarms pool and clears pool", () => {
            const pool = new ObjectPool<TestItem>(() => new TestItem(), 10);
            pool.prewarm(3);
            expect(pool.getStats().available).toBe(3);

            pool.clear();
            expect(pool.getStats().available).toBe(0);
        });

        it("ignores release of object not in use or reset throwing error", () => {
            const pool = new ObjectPool<TestItem>(() => new TestItem(), 5);
            const external = new TestItem();
            pool.release(external); // not in use
            expect(pool.getStats().releases).toBe(0);

            const item = pool.acquire();
            item.reset = () => {
                throw new Error("reset fail");
            };
            pool.release(item);
            expect(pool.getStats().available).toBe(0); // not returned to pool
        });
    });

    describe("StringPool", () => {
        it("interns strings and returns canonical instances", () => {
            const pool = new StringPool();

            const s1 = "hello";
            const s2 = ["h", "e", "l", "l", "o"].join("");

            const interned1 = pool.intern(s1);
            const interned2 = pool.intern(s2);

            expect(interned1).toBe(interned2);
            expect(pool.getStats().hits).toBe(1);
            expect(pool.getStats().misses).toBe(1);
            expect(pool.getStats().hitRate).toBe(50);
        });

        it("skips strings exceeding maxLength", () => {
            const pool = new StringPool();
            const longStr = "a".repeat(150);

            const result = pool.intern(longStr);
            expect(result).toBe(longStr);
            expect(pool.getStats().skipped).toBe(1);
            expect(pool.getStats().poolSize).toBe(0);
        });

        it("evicts oldest strings when pool reaches maxSize", () => {
            const pool = new StringPool();
            (pool as any).maxSize = 2;

            pool.intern("first");
            pool.intern("second");
            pool.intern("third"); // Evicts "first"

            expect(pool.getStats().poolSize).toBe(2);
            expect(pool.getStats().misses).toBe(3);
        });

        it("prewarms and clears strings", () => {
            const pool = new StringPool();
            pool.prewarm(["apple", "banana"]);
            expect(pool.getStats().poolSize).toBe(2);

            pool.clear();
            expect(pool.getStats().poolSize).toBe(0);
        });
    });
});
