import { afterEach, describe, expect, it, vi } from "vitest";
import { ShutdownManager } from "../../src/shared/lifecycle/shutdown-manager";

describe("ShutdownManager", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("clears cleanup timeout timers when handlers finish", async () => {
        vi.useFakeTimers();
        const manager = new ShutdownManager();
        manager.register("fast", vi.fn());

        await manager.shutdown();

        expect(vi.getTimerCount()).toBe(0);
    });

    it("logs timed out handlers and continues shutdown", async () => {
        vi.useFakeTimers();
        const log = vi.fn();
        const manager = new ShutdownManager(log);
        const afterTimeout = vi.fn();
        manager.register("slow", () => new Promise(() => {}), 1);
        manager.register("next", afterTimeout, 2);

        const shutdown = manager.shutdown();
        await vi.advanceTimersByTimeAsync(5_000);
        await shutdown;

        expect(afterTimeout).toHaveBeenCalled();
        expect(log).toHaveBeenCalledWith(expect.stringContaining("slow failed: Timeout"));
        expect(vi.getTimerCount()).toBe(0);
    });

    it("lets a handler with a longer budget finish past the default timeout", async () => {
        vi.useFakeTimers();
        const log = vi.fn();
        const manager = new ShutdownManager(log);
        manager.register("terminate", () => new Promise<void>(resolve => setTimeout(resolve, 8_000)), 1, 12_000);

        const shutdown = manager.shutdown();
        await vi.advanceTimersByTimeAsync(8_000);
        await shutdown;

        expect(log).toHaveBeenCalledWith(expect.stringContaining("✓ terminate completed"));
        expect(log).not.toHaveBeenCalledWith(expect.stringContaining("terminate failed"));
    });
});
