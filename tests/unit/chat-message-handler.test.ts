import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChatMessageHandler } from "../../src/plugin-handlers/chat-message-handler";
import { HookRegistry } from "../../src/hooks/registry";
import { HOOK_ACTIONS } from "../../src/hooks/constants";
import type { ChatMessageHandlerContext, PluginSessionState } from "../../src/plugin-handlers/context";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

describe("createChatMessageHandler", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("records user turn time and tracks agent name for session", async () => {
        const session: PluginSessionState = {
            active: true,
            step: 0,
            timestamp: 0,
            startTime: Date.now(),
            lastStepTime: 0,
            tokens: { totalInput: 0, totalOutput: 0, estimatedCost: 0 },
        };
        const ctx: ChatMessageHandlerContext = {
            client: {} as ChatMessageHandlerContext["client"],
            directory: "/tmp/test",
            sessions: new Map([["session-1", session]]),
        };

        vi.spyOn(HookRegistry.getInstance(), "executeChat").mockResolvedValue({
            action: HOOK_ACTIONS.PROCESS,
        });

        await createChatMessageHandler(ctx)(
            { sessionID: "session-1", agent: "Worker" },
            { parts: [{ type: "text", text: "hello" }] },
        );

        expect(session.lastUserMessageAt).toBeGreaterThan(0);
        expect(session.agent).toBe("worker");
    });

    it("clears output parts when a chat hook intercepts a control message", async () => {
        const ctx: ChatMessageHandlerContext = {
            client: {} as ChatMessageHandlerContext["client"],
            directory: "/tmp/test",
            sessions: new Map(),
        };
        const output = { parts: [{ type: "text", text: "/cancel" }] };

        vi.spyOn(HookRegistry.getInstance(), "executeChat").mockResolvedValue({
            action: HOOK_ACTIONS.INTERCEPT,
        });

        await createChatMessageHandler(ctx)({ sessionID: "session-1" }, output);

        expect(output.parts).toEqual([]);
    });

    it("updates textPart.text when hookResult.modifiedMessage is present", async () => {
        const ctx: ChatMessageHandlerContext = {
            client: {} as ChatMessageHandlerContext["client"],
            directory: "/tmp/test",
            sessions: new Map(),
        };
        const output = { parts: [{ type: "text", text: "original text" }] };

        vi.spyOn(HookRegistry.getInstance(), "executeChat").mockResolvedValue({
            action: HOOK_ACTIONS.PROCESS,
            modifiedMessage: "modified text",
        });

        await createChatMessageHandler(ctx)({ sessionID: "session-1" }, output);

        expect((output.parts[0] as any).text).toBe("modified text");
    });

    it("ignores messages without valid text parts", async () => {
        const ctx: ChatMessageHandlerContext = {
            client: {} as ChatMessageHandlerContext["client"],
            directory: "/tmp/test",
            sessions: new Map(),
        };

        const outputNoParts = { parts: [] };
        await createChatMessageHandler(ctx)({ sessionID: "session-1" }, outputNoParts);
        expect(outputNoParts.parts).toEqual([]);

        const outputNonText = { parts: [{ type: "image", data: "..." } as any] };
        await createChatMessageHandler(ctx)({ sessionID: "session-1" }, outputNonText);
        expect(outputNonText.parts).toHaveLength(1);
    });
});
