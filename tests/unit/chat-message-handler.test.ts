import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChatMessageHandler } from "../../src/plugin-handlers/chat-message-handler";
import { HookRegistry } from "../../src/hooks/registry";
import { HOOK_ACTIONS } from "../../src/hooks/constants";
import type { ChatMessageHandlerContext, SessionState } from "../../src/plugin-handlers/interfaces";
import { consumeRouterDecision, clearRouterDecision } from "../../src/core/router/intent-router";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

describe("createChatMessageHandler", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("records user turn time for tracked sessions", async () => {
        const session: SessionState = {
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
            { sessionID: "session-1" },
            { parts: [{ type: "text", text: "hello" }] },
        );

        expect(session.lastUserMessageAt).toBeGreaterThan(0);
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

    it("stores a consumable router decision for a processed message", async () => {
        clearRouterDecision("router-proc");
        const ctx: ChatMessageHandlerContext = {
            client: {} as ChatMessageHandlerContext["client"],
            directory: "/tmp/test",
            sessions: new Map(),
        };
        vi.spyOn(HookRegistry.getInstance(), "executeChat").mockResolvedValue({
            action: HOOK_ACTIONS.PROCESS,
        });

        await createChatMessageHandler(ctx)(
            { sessionID: "router-proc" },
            { parts: [{ type: "text", text: "hello there" }] },
        );

        const decision = consumeRouterDecision("router-proc");
        expect(decision).not.toBeNull();
        expect(decision?.route).toBe("commander");
        // consumed exactly once
        expect(consumeRouterDecision("router-proc")).toBeNull();
    });

    it("leaves no router decision when the message is intercepted", async () => {
        clearRouterDecision("router-intercept");
        const ctx: ChatMessageHandlerContext = {
            client: {} as ChatMessageHandlerContext["client"],
            directory: "/tmp/test",
            sessions: new Map(),
        };
        vi.spyOn(HookRegistry.getInstance(), "executeChat").mockResolvedValue({
            action: HOOK_ACTIONS.INTERCEPT,
        });

        await createChatMessageHandler(ctx)(
            { sessionID: "router-intercept" },
            { parts: [{ type: "text", text: "/cancel" }] },
        );

        expect(consumeRouterDecision("router-intercept")).toBeNull();
    });

    it("skips routing when disabled via env flag", async () => {
        clearRouterDecision("router-disabled");
        const prev = process.env.ORCHESTRATOR_ROUTER_DISABLED;
        process.env.ORCHESTRATOR_ROUTER_DISABLED = "1";
        try {
            const ctx: ChatMessageHandlerContext = {
                client: {} as ChatMessageHandlerContext["client"],
                directory: "/tmp/test",
                sessions: new Map(),
            };
            vi.spyOn(HookRegistry.getInstance(), "executeChat").mockResolvedValue({
                action: HOOK_ACTIONS.PROCESS,
            });

            await createChatMessageHandler(ctx)(
                { sessionID: "router-disabled" },
                { parts: [{ type: "text", text: "hello there" }] },
            );

            expect(consumeRouterDecision("router-disabled")).toBeNull();
        } finally {
            if (prev === undefined) delete process.env.ORCHESTRATOR_ROUTER_DISABLED;
            else process.env.ORCHESTRATOR_ROUTER_DISABLED = prev;
        }
    });
});
