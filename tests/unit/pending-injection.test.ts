import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    queuePrompts,
    queueNotice,
    peekPrompts,
    hasPendingPrompts,
    clearPrompts,
    flushPrompts,
    resetPendingInjections,
} from "../../src/core/session/pending-injection";
import { resetSessionActivity } from "../../src/core/session/activity";

const SESSION = "ses_pending";

function client(options: { busy?: boolean; failPrompt?: boolean } = {}) {
    const prompt = vi.fn(async () => {
        if (options.failPrompt) throw new Error("transport failure");
        return {};
    });
    return {
        prompt,
        client: {
            session: {
                prompt,
                status: vi.fn(async () => ({
                    data: options.busy ? { [SESSION]: { type: "busy" } } : {},
                })),
            },
        } as never,
    };
}

/**
 * Issue #38: done-hooks fire at the end of every step, not every turn. Their
 * prompts wait here until the session is genuinely idle.
 */
describe("deferred prompt injection (issue #38)", () => {
    beforeEach(() => {
        resetPendingInjections();
        resetSessionActivity();
    });

    describe("queuePrompts", () => {
        it("holds prompts without sending them", () => {
            queuePrompts(SESSION, ["continue"]);

            expect(hasPendingPrompts(SESSION)).toBe(true);
            expect(peekPrompts(SESSION)).toEqual(["continue"]);
        });

        it("keeps only the newest snapshot", () => {
            queuePrompts(SESSION, ["older state"]);
            queuePrompts(SESSION, ["newer state"]);

            expect(peekPrompts(SESSION)).toEqual(["newer state"]);
        });

        it("drops duplicates within one snapshot", () => {
            queuePrompts(SESSION, ["same", "same", "other"]);

            expect(peekPrompts(SESSION)).toEqual(["same", "other"]);
        });

        it("ignores blank prompts and empty session ids", () => {
            queuePrompts(SESSION, ["   ", ""]);
            queuePrompts("", ["real prompt"]);

            expect(hasPendingPrompts(SESSION)).toBe(false);
            expect(hasPendingPrompts("")).toBe(false);
        });
    });

    describe("flushPrompts", () => {
        it("does not send a queue cleared while session status is pending", async () => {
            queuePrompts(SESSION, ["continue"]);
            let resolveStatus!: (value: { data: object }) => void;
            const api = { session: {
                status: vi.fn(() => new Promise(resolve => { resolveStatus = resolve; })),
                prompt: vi.fn().mockResolvedValue({ data: {} }),
            } };
            const flush = flushPrompts(api as never, SESSION);
            clearPrompts(SESSION);
            resolveStatus({ data: {} });
            await expect(flush).resolves.toBe(false);
            expect(api.session.prompt).not.toHaveBeenCalled();
        });

        it("does not send a snapshot replaced while checking session status", async () => {
            queuePrompts(SESSION, ["old state"]);
            const api = { session: {
                status: vi.fn(async () => { queuePrompts(SESSION, ["new state"]); return { data: {} }; }),
                prompt: vi.fn().mockResolvedValue({ data: {} }),
            } };
            await expect(flushPrompts(api as never, SESSION)).resolves.toBe(false);
            expect(api.session.prompt).not.toHaveBeenCalled();
            expect(peekPrompts(SESSION)).toEqual(["new state"]);
        });
        it.each(["reject", "error"])("retains one-shot notices after %s while discarding stale snapshots", async (failure) => {
            queueNotice(SESSION, "task done");
            queuePrompts(SESSION, ["old snapshot"]);
            const { client: api, prompt } = client({ failPrompt: failure === "reject" });
            if (failure === "error") prompt.mockResolvedValueOnce({ error: "offline" });
            await expect(flushPrompts(api, SESSION)).resolves.toBe(false);
            expect(peekPrompts(SESSION)).toEqual(["task done"]);
        });

        it("preserves notices arriving during the busy check", async () => {
            queueNotice(SESSION, "first");
            const api = { session: {
                status: vi.fn(async () => { queueNotice(SESSION, "second"); return { data: {} }; }),
                prompt: vi.fn().mockResolvedValue({ data: {} }),
            } };
            await flushPrompts(api as never, SESSION);
            expect(peekPrompts(SESSION)).toEqual(["second"]);
        });
        it("sends the queue as one synthetic message when idle", async () => {
            queuePrompts(SESSION, ["first", "second"]);
            const { client: api, prompt } = client();

            await expect(flushPrompts(api, SESSION)).resolves.toBe(true);
            expect(prompt).toHaveBeenCalledWith({
                path: { id: SESSION },
                body: {
                    parts: [
                        { type: "text", text: "first", synthetic: true },
                        { type: "text", text: "second", synthetic: true },
                    ],
                },
            });
            expect(hasPendingPrompts(SESSION)).toBe(false);
        });

        it("holds the queue while the session is busy", async () => {
            queuePrompts(SESSION, ["continue"]);
            const { client: api, prompt } = client({ busy: true });

            await expect(flushPrompts(api, SESSION)).resolves.toBe(false);
            expect(prompt).not.toHaveBeenCalled();
            expect(hasPendingPrompts(SESSION), "a busy session must not lose its queue").toBe(true);
        });

        it("is a no-op with nothing queued", async () => {
            const { client: api, prompt } = client();

            await expect(flushPrompts(api, SESSION)).resolves.toBe(false);
            expect(prompt).not.toHaveBeenCalled();
        });

        it("does not replay a failed send against a later turn", async () => {
            queuePrompts(SESSION, ["continue"]);
            const { client: api } = client({ failPrompt: true });

            await expect(flushPrompts(api, SESSION)).resolves.toBe(false);
            expect(hasPendingPrompts(SESSION)).toBe(false);
        });
    });

    it("clears a single session", () => {
        queuePrompts(SESSION, ["continue"]);
        clearPrompts(SESSION);

        expect(hasPendingPrompts(SESSION)).toBe(false);
    });
});
