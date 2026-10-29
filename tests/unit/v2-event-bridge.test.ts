import type { Plugin } from "@opencode/plugin";
import { describe, expect, it, vi } from "vitest";
import { startV2EventBridge } from "../../src/v2/event-bridge.js";

const OWN_LOCATION = { directory: "/tmp/event-bridge-project", project: { directory: "/tmp/event-bridge-project" } };

describe("OpenCode 2 event bridge", () => {
    // The host streams events across all of its locations and runs one plugin
    // instance per location, so each instance must handle only its own.
    it("skips events from other locations and keeps unattributed ones", async () => {
        const handler = vi.fn().mockResolvedValue(undefined);
        const context = {
            location: OWN_LOCATION,
            event: { subscribe: async function* () {
                yield { type: "session.deleted", location: { directory: "/tmp/other-project" }, data: { sessionID: "foreign" } };
                yield { type: "session.created", data: { sessionID: "foreign-created", location: { directory: "/tmp/other-project" } } };
                yield { type: "session.deleted", location: { directory: "/tmp/event-bridge-project/" }, data: { sessionID: "own" } };
                yield { type: "session.deleted", data: { sessionID: "unattributed" } };
            } },
        } as unknown as Plugin.Context;

        const stop = startV2EventBridge(context, handler, new Map());
        await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(2));
        stop();

        const sessions = handler.mock.calls.map(([input]) => input.event.properties.sessionID);
        expect(sessions).toEqual(["own", "unattributed"]);
    });

    it("skips unlocated events for a session already seen in another location", async () => {
        const handler = vi.fn().mockResolvedValue(undefined);
        const context = {
            location: OWN_LOCATION,
            event: { subscribe: async function* () {
                yield { type: "session.step.started", location: { directory: "/tmp/other-project" }, data: { sessionID: "foreign" } };
                yield { type: "session.execution.succeeded", data: { sessionID: "foreign" } };
                yield { type: "session.execution.succeeded", data: { sessionID: "own" } };
            } },
        } as unknown as Plugin.Context;

        const stop = startV2EventBridge(context, handler, new Map());
        await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
        stop();

        expect(handler.mock.calls.map(([input]) => input.event.properties.sessionID)).toEqual(["own"]);
    });

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
        const context = { location: OWN_LOCATION, event: { subscribe } } as unknown as Plugin.Context;

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
            location: OWN_LOCATION,
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
                location: OWN_LOCATION,
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
                location: OWN_LOCATION,
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
