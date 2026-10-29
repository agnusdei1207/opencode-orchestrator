import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleCompletedAssistantMessage } from "../../src/plugin-handlers/assistant-done-handler";
import { HookRegistry } from "../../src/hooks/registry";
import {
    peekPrompts,
    hasPendingPrompts,
    resetPendingInjections,
} from "../../src/core/session/pending-injection";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

describe("handleCompletedAssistantMessage", () => {
    const executeDone = vi.fn();

    beforeEach(() => {
        vi.spyOn(HookRegistry, "getInstance").mockReturnValue({
            executeDone,
        } as unknown as HookRegistry);
        executeDone.mockReset();
        resetPendingInjections();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        resetPendingInjections();
    });

    it("runs done hooks on a completed assistant message and de-duplicates by message ID", async () => {
        executeDone.mockResolvedValue({ action: "inject", prompts: ["Continue mission"] });

        const messages = vi.fn().mockResolvedValue([
            { id: "message-0", role: "assistant", text: "Older", toolCallCount: 0 },
            { id: "message-1", role: "assistant", text: "Done\nVerified", toolCallCount: 1 },
        ]);
        const prompt = vi.fn().mockResolvedValue(undefined);
        const ctx = {
            client: { messages, prompt },
            directory: "/tmp/test",
            sessions: new Map([
                ["session-1", {
                    active: true,
                    step: 2,
                    timestamp: 0,
                    startTime: 0,
                    lastStepTime: 0,
                    tokens: { totalInput: 0, totalOutput: 0 },
                }],
            ]),
        } as any;

        await handleCompletedAssistantMessage(ctx, "session-1", "message-1");
        await handleCompletedAssistantMessage(ctx, "session-1", "message-1");

        expect(messages).toHaveBeenCalledExactlyOnceWith("session-1");
        expect(executeDone).toHaveBeenCalledWith(
            expect.objectContaining({ sessionID: "session-1", directory: "/tmp/test" }),
            "Done\nVerified",
        );
        expect(ctx.sessions.get("session-1").lastCompletedMessageID).toBe("message-1");

        // A completed assistant message ends a step, not necessarily the turn,
        // so the prompt is queued for the next idle boundary rather than sent
        // into work that may still be in flight (issue #38).
        expect(prompt).not.toHaveBeenCalled();
        expect(peekPrompts("session-1")).toEqual(["Continue mission"]);
    });

    it("queues nothing when the done hooks ask to continue", async () => {
        executeDone.mockResolvedValue({ action: "continue", prompts: [] });
        const ctx = contextFor("session-2");

        await handleCompletedAssistantMessage(ctx, "session-2", "message-1");

        expect(hasPendingPrompts("session-2")).toBe(false);
    });

    it("keeps only the newest snapshot across consecutive steps", async () => {
        const ctx = contextFor("session-3");

        executeDone.mockResolvedValue({ action: "inject", prompts: ["step one state"] });
        await handleCompletedAssistantMessage(ctx, "session-3", "message-1");

        executeDone.mockResolvedValue({ action: "inject", prompts: ["step two state"] });
        await handleCompletedAssistantMessage(ctx, "session-3", "message-2");

        // Each snapshot describes current mission state; replaying the stale one
        // would only re-tell the model something the newer prompt already says.
        expect(peekPrompts("session-3")).toEqual(["step two state"]);
    });
});

function contextFor(sessionID: string) {
    return {
        client: {
            messages: vi.fn().mockResolvedValue([{ id: "message-1", role: "assistant", text: "Done", toolCallCount: 0 }]),
            prompt: vi.fn().mockResolvedValue(undefined),
        },
        directory: "/tmp/test",
        sessions: new Map([
            [sessionID, {
                active: true,
                step: 0,
                timestamp: 0,
                startTime: 0,
                lastStepTime: 0,
                tokens: { totalInput: 0, totalOutput: 0 },
            }],
        ]),
    } as any;
}
