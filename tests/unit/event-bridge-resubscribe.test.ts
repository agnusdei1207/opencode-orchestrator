/**
 * Event bridge resubscription: without host events, mission continuation,
 * abort handling and child-session tracking all stop, so a stream that ends
 * or throws must be resubscribed (with backoff) until the plugin is disposed.
 */

import type { Plugin } from "@opencode/plugin";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startEventBridge } from "../../src/host/event-bridge.js";

type Subscribe = (input: { signal: AbortSignal }) => AsyncIterable<unknown>;
type HandledEvent = { event: { type: string; properties: Record<string, unknown> } };

function createContext(subscribe: Subscribe): Plugin.Context {
    return {
        location: { directory: process.cwd(), project: { directory: process.cwd() } },
        event: { subscribe },
    } as unknown as Plugin.Context;
}

async function* events(...items: unknown[]): AsyncGenerator<unknown> {
    for (const item of items) yield item;
}

async function* failing(error: Error): AsyncGenerator<unknown> {
    throw error;
}

const started = (sessionID: string) => ({ type: "session.execution.started", data: { sessionID } });

describe("event bridge resubscription", () => {
    let stop: (() => void) | undefined;

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        stop?.();
        stop = undefined;
        vi.useRealTimers();
    });

    it("resubscribes after the stream ends, waiting the initial 1s backoff", async () => {
        const subscribe = vi.fn<Subscribe>(() => events());
        stop = startEventBridge(createContext(subscribe), vi.fn(async () => {}), new Map());

        await vi.advanceTimersByTimeAsync(0);
        expect(subscribe).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(999);
        expect(subscribe).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);
        expect(subscribe).toHaveBeenCalledTimes(2);
    });

    it("resubscribes after the stream throws and keeps delivering events", async () => {
        const handler = vi.fn(async (_input: HandledEvent) => {});
        const subscribe = vi.fn<Subscribe>()
            .mockImplementationOnce(() => failing(new Error("connection reset")))
            .mockImplementation(() => events(started("ses_after_error")));
        stop = startEventBridge(createContext(subscribe), handler, new Map());

        await vi.advanceTimersByTimeAsync(0);
        expect(subscribe).toHaveBeenCalledTimes(1);
        expect(handler).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1_000);
        expect(subscribe).toHaveBeenCalledTimes(2);
        expect(handler).toHaveBeenCalledWith({
            event: { type: "session.status", properties: { sessionID: "ses_after_error", status: { type: "busy" } } },
        });
    });

    it("also resubscribes when subscribe itself throws synchronously", async () => {
        const subscribe = vi.fn<Subscribe>()
            .mockImplementationOnce(() => { throw new Error("not connected"); })
            .mockImplementation(() => events());
        stop = startEventBridge(createContext(subscribe), vi.fn(async () => {}), new Map());

        await vi.advanceTimersByTimeAsync(1_000);
        expect(subscribe).toHaveBeenCalledTimes(2);
    });

    it("doubles the delay on consecutive empty streams and caps it at 30s", async () => {
        const subscribe = vi.fn<Subscribe>(() => events());
        stop = startEventBridge(createContext(subscribe), vi.fn(async () => {}), new Map());
        await vi.advanceTimersByTimeAsync(0);

        const expectedDelays = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000];
        for (const [index, delay] of expectedDelays.entries()) {
            await vi.advanceTimersByTimeAsync(delay - 1);
            expect(subscribe).toHaveBeenCalledTimes(index + 1);
            await vi.advanceTimersByTimeAsync(1);
            expect(subscribe).toHaveBeenCalledTimes(index + 2);
        }
    });

    it("resets the backoff once a stream delivers an event", async () => {
        const subscribe = vi.fn<Subscribe>()
            .mockImplementationOnce(() => events())
            .mockImplementationOnce(() => events())
            .mockImplementationOnce(() => events(started("ses_reset")))
            .mockImplementation(() => events());
        stop = startEventBridge(createContext(subscribe), vi.fn(async () => {}), new Map());

        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(1_000);
        await vi.advanceTimersByTimeAsync(2_000);
        expect(subscribe).toHaveBeenCalledTimes(3);

        // The third stream delivered an event, so the next wait is 1s again rather than 4s.
        await vi.advanceTimersByTimeAsync(1_000);
        expect(subscribe).toHaveBeenCalledTimes(4);
    });

    it("clears busy statuses between attempts so stale sessions do not look busy", async () => {
        const statuses = new Map<string, string>();
        const statusesSeenAtSubscribe: string[][] = [];
        let attempts = 0;
        const subscribe = vi.fn<Subscribe>(() => {
            statusesSeenAtSubscribe.push([...statuses.keys()]);
            attempts++;
            return attempts === 1 ? events(started("ses_stale")) : events();
        });
        stop = startEventBridge(createContext(subscribe), vi.fn(async () => {}), statuses);

        await vi.advanceTimersByTimeAsync(0);
        // The stream has ended; the busy status it reported is no longer trusted.
        expect(statuses.size).toBe(0);

        await vi.advanceTimersByTimeAsync(1_000);
        expect(statusesSeenAtSubscribe).toEqual([[], []]);
    });

    it("keeps statuses while the stream is live", async () => {
        const statuses = new Map<string, string>();
        let release!: () => void;
        const subscribe = vi.fn<Subscribe>(() => (async function* () {
            yield started("ses_live");
            await new Promise<void>(resolve => { release = resolve; });
        })());
        stop = startEventBridge(createContext(subscribe), vi.fn(async () => {}), statuses);

        await vi.advanceTimersByTimeAsync(0);
        expect(statuses.get("ses_live")).toBe("busy");

        release();
        await vi.advanceTimersByTimeAsync(0);
        expect(statuses.has("ses_live")).toBe(false);
    });

    it("stops resubscribing after dispose, including during a backoff wait", async () => {
        const subscribe = vi.fn<Subscribe>(() => events());
        stop = startEventBridge(createContext(subscribe), vi.fn(async () => {}), new Map());
        await vi.advanceTimersByTimeAsync(0);
        expect(subscribe).toHaveBeenCalledTimes(1);

        stop();
        await vi.advanceTimersByTimeAsync(120_000);

        expect(subscribe).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("aborts the live subscription on dispose and does not resubscribe", async () => {
        let signal: AbortSignal | undefined;
        const subscribe = vi.fn<Subscribe>(input => {
            signal = input.signal;
            return (async function* () {
                await new Promise(resolve => input.signal.addEventListener("abort", resolve, { once: true }));
                throw new Error("aborted");
            })();
        });
        stop = startEventBridge(createContext(subscribe), vi.fn(async () => {}), new Map());
        await vi.advanceTimersByTimeAsync(0);
        expect(signal?.aborted).toBe(false);

        stop();
        await vi.advanceTimersByTimeAsync(60_000);

        expect(signal?.aborted).toBe(true);
        expect(subscribe).toHaveBeenCalledTimes(1);
    });
});
