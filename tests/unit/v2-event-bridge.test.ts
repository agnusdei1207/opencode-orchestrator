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

    it("keeps delivering events after a handler throws", async () => {
        const handler = vi.fn()
            .mockRejectedValueOnce(new Error("handler failed"))
            .mockResolvedValue(undefined);
        const context = {
            event: { subscribe: async function* () {
                yield { type: "session.deleted", data: { sessionID: "session-1" } };
                yield { type: "session.deleted", data: { sessionID: "session-2" } };
            } },
        } as unknown as Plugin.Context;

        const stop = startV2EventBridge(context, handler, new Map());

        await vi.waitFor(() => expect(handler).toHaveBeenCalledWith({
            event: expect.objectContaining({ properties: expect.objectContaining({ sessionID: "session-2" }) }),
        }));
        stop();
    });

    it.each(["session.execution.failed", "session.execution.interrupted"])(
        "marks a session idle after %s",
        async terminalType => {
            const statuses = new Map<string, string>();
            const handler = vi.fn().mockResolvedValue(undefined);
            const context = {
                event: { subscribe: async function* () {
                    yield { type: "session.execution.started", data: { sessionID: "session-1" } };
                    yield { type: terminalType, data: { sessionID: "session-1", error: { message: "failed" } } };
                } },
            } as unknown as Plugin.Context;

            const stop = startV2EventBridge(context, handler, statuses);
            await vi.waitFor(() => expect(handler).toHaveBeenCalledWith(expect.objectContaining({
                event: expect.objectContaining({ type: "session.error" }),
            })));

            expect(handler).toHaveBeenCalledWith({
                event: { type: terminalType, properties: expect.objectContaining({ sessionID: "session-1" }) },
            });
            expect(statuses.has("session-1")).toBe(false);
            stop();
        },
    );

    it.each(["session.execution.succeeded", "session.deleted"])(
        "removes stale session status after %s",
        async terminalType => {
            const statuses = new Map<string, string>();
            const handler = vi.fn().mockResolvedValue(undefined);
            const context = {
                event: { subscribe: async function* () {
                    yield { type: "session.execution.started", data: { sessionID: "session-1" } };
                    yield { type: terminalType, data: { sessionID: "session-1" } };
                } },
            } as unknown as Plugin.Context;

            const stop = startV2EventBridge(context, handler, statuses);
            await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(2));

            expect(statuses.has("session-1")).toBe(false);
            stop();
        },
    );
});
