import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleCompletedAssistantMessage } from "../../src/plugin-handlers/assistant-done-handler";
import { HookRegistry } from "../../src/hooks/registry";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

describe("handleCompletedAssistantMessage", () => {
    const executeDone = vi.fn();

    beforeEach(() => {
        vi.spyOn(HookRegistry, "getInstance").mockReturnValue({
            executeDone,
        } as unknown as HookRegistry);
        executeDone.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("runs done hooks on a completed assistant message and de-duplicates by message ID", async () => {
        executeDone.mockResolvedValue({ action: "inject", prompts: ["Continue mission"] });

        const message = vi.fn().mockResolvedValue({
            data: {
                parts: [
                    { type: "text", text: "Done" },
                    { type: "reasoning", text: "Verified" },
                ],
            },
        });
        const prompt = vi.fn().mockResolvedValue({});
        const ctx = {
            client: { session: { message, prompt } },
            directory: "/tmp/test",
            sessions: new Map([
                ["session-1", {
                    active: true,
                    step: 2,
                    timestamp: 0,
                    startTime: 0,
                    lastStepTime: 0,
                    tokens: { totalInput: 0, totalOutput: 0, estimatedCost: 0 },
                }],
            ]),
        } as any;

        await handleCompletedAssistantMessage(ctx, "session-1", "message-1");
        await handleCompletedAssistantMessage(ctx, "session-1", "message-1");

        expect(message).toHaveBeenCalledTimes(1);
        expect(prompt).toHaveBeenCalledTimes(1);
        expect(executeDone).toHaveBeenCalledWith(
            expect.objectContaining({ sessionID: "session-1", directory: "/tmp/test" }),
            "Done\nVerified",
        );
        expect(ctx.sessions.get("session-1").lastCompletedMessageID).toBe("message-1");
    });
});
