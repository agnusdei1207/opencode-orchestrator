import type { Plugin } from "@opencode/plugin";
import { describe, expect, it, vi } from "vitest";
import { startV2EventBridge } from "../../src/v2/event-bridge.js";

describe("OpenCode 2 event bridge", () => {
    it("aborts the host subscription when the plugin stops", async () => {
        const streamClosed = vi.fn();
        const subscribe = vi.fn((options?: { signal?: AbortSignal }) => ({
            async *[Symbol.asyncIterator]() {
                await new Promise<void>(resolve => {
                    options?.signal?.addEventListener("abort", () => resolve(), { once: true });
                });
                streamClosed();
            },
        }));
        const context = { event: { subscribe } } as unknown as Plugin.Context;

        const stop = startV2EventBridge(context, vi.fn(), new Map());
        stop();

        expect(subscribe).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
        await vi.waitFor(() => expect(streamClosed).toHaveBeenCalledOnce());
    });
});
