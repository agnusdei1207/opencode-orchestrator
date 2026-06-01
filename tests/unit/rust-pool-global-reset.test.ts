import { afterEach, describe, expect, it } from "vitest";
import {
    RustToolPool,
    getRustToolPool,
    resetRustToolPool,
    shutdownRustToolPool,
} from "../../src/tools/rust-pool.js";

describe("global RustToolPool reset", () => {
    afterEach(async () => {
        await shutdownRustToolPool();
    });

    it("skips resetting the current singleton when the expected pool is stale", async () => {
        const currentPool = getRustToolPool();
        const stalePool = new RustToolPool();

        try {
            await resetRustToolPool("stale caller reset", stalePool);

            expect(getRustToolPool()).toBe(currentPool);
        } finally {
            await stalePool.shutdown();
        }
    });

    it("clears the expected singleton so the next caller receives a fresh pool", async () => {
        const currentPool = getRustToolPool();

        await resetRustToolPool("expected caller reset", currentPool);

        expect(getRustToolPool()).not.toBe(currentPool);
    });
});
