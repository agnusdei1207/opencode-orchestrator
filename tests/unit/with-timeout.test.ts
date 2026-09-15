import { afterEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "../../src/core/async/with-timeout.js";

describe("withTimeout", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns a value that settles before the deadline", async () => {
        await expect(withTimeout(Promise.resolve("done"), 1_000)).resolves.toBe("done");
    });

    it("rejects with the configured message after the deadline", async () => {
        vi.useFakeTimers();
        const result = withTimeout(new Promise<never>(() => undefined), 50, "request expired");
        const assertion = expect(result).rejects.toThrow("request expired");

        await vi.advanceTimersByTimeAsync(50);

        await assertion;
    });

    it("clears its timer when the wrapped promise settles", async () => {
        vi.useFakeTimers();

        await expect(withTimeout(Promise.resolve("done"), 1_000)).resolves.toBe("done");

        expect(vi.getTimerCount()).toBe(0);
    });
});
