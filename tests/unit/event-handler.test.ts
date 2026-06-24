import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEventHandler } from "../../src/plugin-handlers/event-handler";
import { handleCompletedAssistantMessage } from "../../src/plugin-handlers/assistant-done-handler";
import * as SessionRecovery from "../../src/core/recovery/session-recovery";
import * as ContextMonitor from "../../src/core/context";
import * as TodoContinuation from "../../src/core/loop/todo-continuation";
import * as MissionLoopHandler from "../../src/core/loop/mission-loop-handler";
import * as MissionLoop from "../../src/core/loop/mission-loop";
import * as Toast from "../../src/core/notification/toast";
import type { EventHandlerContext } from "../../src/plugin-handlers/interfaces";

vi.mock("../../src/core/agents/manager", () => ({
    ParallelAgentManager: {
        getInstance: vi.fn(() => ({
            handleEvent: vi.fn(),
        })),
    },
}));
vi.mock("../../src/core/notification/toast", () => ({
    presets: {
        missionStarted: vi.fn(),
        sessionCompleted: vi.fn(),
        taskFailed: vi.fn(),
    },
}));
vi.mock("../../src/core/progress/tracker", () => ({
    clearSession: vi.fn(),
}));
vi.mock("../../src/core/recovery/session-recovery", () => ({
    cleanupSessionRecovery: vi.fn(),
    handleSessionError: vi.fn(),
    markRecoveryComplete: vi.fn(),
}));
vi.mock("../../src/core/loop/todo-continuation", () => ({
    cleanupSession: vi.fn(),
    handleAbort: vi.fn(),
    handleSessionError: vi.fn(),
    handleUserMessage: vi.fn(),
    handleSessionIdle: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/core/loop/mission-loop-handler", () => ({
    cleanupSession: vi.fn(),
    handleAbort: vi.fn(),
    handleUserMessage: vi.fn(),
    handleMissionIdle: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/core/loop/mission-loop", () => ({
    isLoopActive: vi.fn(() => false),
}));
vi.mock("../../src/core/context", () => ({
    cleanupSession: vi.fn(),
    checkContextWindow: vi.fn(),
}));
vi.mock("../../src/plugin-handlers/assistant-done-handler", () => ({
    handleCompletedAssistantMessage: vi.fn(),
}));

describe("createEventHandler", () => {
    let ctx: EventHandlerContext;

    beforeEach(() => {
        ctx = {
            client: {} as EventHandlerContext["client"],
            directory: "/tmp/test",
            sessions: new Map([
                ["session-1", {
                    active: true,
                    step: 0,
                    timestamp: 0,
                    startTime: Date.now(),
                    lastStepTime: 0,
                    tokens: { totalInput: 0, totalOutput: 0, estimatedCost: 0 },
                }],
            ]),
            state: {
                missionActive: false,
                sessions: new Map(),
            },
        };
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("routes completed assistant messages through the done-hook bridge", async () => {
        const handler = createEventHandler(ctx);

        await handler({
            event: {
                type: "message.updated",
                properties: {
                    info: {
                        id: "message-1",
                        sessionID: "session-1",
                        role: "assistant",
                        time: { completed: Date.now() },
                        tokens: {
                            input: 10,
                            output: 5,
                            reasoning: 0,
                        },
                    },
                },
            },
        });

        expect(SessionRecovery.markRecoveryComplete).toHaveBeenCalledWith("session-1");
        expect(ContextMonitor.checkContextWindow).toHaveBeenCalledWith("session-1", 15);
        expect(handleCompletedAssistantMessage).toHaveBeenCalledWith(ctx, "session-1", "message-1");
        expect(ctx.sessions.get("session-1").lastAssistantCompletedAt).toBeGreaterThan(0);
    });

    it("reads SDK session ids from info.id for created and deleted events", async () => {
        const handler = createEventHandler(ctx);

        await handler({
            event: {
                type: "session.created",
                properties: {
                    info: {
                        id: "session-created",
                    },
                },
            },
        });

        await handler({
            event: {
                type: "session.deleted",
                properties: {
                    info: {
                        id: "session-1",
                    },
                },
            },
        });

        expect(Toast.presets.missionStarted).toHaveBeenCalledWith("Session session-crea...");
        expect(ctx.sessions.has("session-1")).toBe(false);
        expect(SessionRecovery.cleanupSessionRecovery).toHaveBeenCalledWith("session-1");
        expect(TodoContinuation.cleanupSession).toHaveBeenCalledWith("session-1");
        expect(MissionLoopHandler.cleanupSession).toHaveBeenCalledWith("session-1");
        expect(ContextMonitor.cleanupSession).toHaveBeenCalledWith("session-1");
    });

    it("prefers direct SDK sessionID over nested info.id for session lifecycle events", async () => {
        const handler = createEventHandler(ctx);

        await handler({
            event: {
                type: "session.created",
                properties: {
                    sessionID: "session-direct",
                    info: {
                        id: "session-nested",
                    },
                },
            },
        });

        ctx.sessions.set("session-direct", {
            active: true,
            step: 0,
            timestamp: 0,
            startTime: Date.now(),
            lastStepTime: 0,
            tokens: { totalInput: 0, totalOutput: 0, estimatedCost: 0 },
        });

        await handler({
            event: {
                type: "session.deleted",
                properties: {
                    sessionID: "session-direct",
                    info: {
                        id: "session-nested",
                    },
                },
            },
        });

        expect(Toast.presets.missionStarted).toHaveBeenCalledWith("Session session-dire...");
        expect(ctx.sessions.has("session-direct")).toBe(false);
        expect(ctx.sessions.has("session-nested")).toBe(false);
        expect(SessionRecovery.cleanupSessionRecovery).toHaveBeenCalledWith("session-direct");
        expect(SessionRecovery.cleanupSessionRecovery).not.toHaveBeenCalledWith("session-nested");
    });

    it("treats idle without an assistant completion after the user turn as an abort", async () => {
        vi.useFakeTimers();
        const handler = createEventHandler(ctx);
        ctx.sessions.get("session-1").lastUserMessageAt = Date.now();

        await handler({
            event: {
                type: "session.idle",
                properties: { sessionID: "session-1" },
            },
        });

        await vi.advanceTimersByTimeAsync(500);

        expect(TodoContinuation.handleAbort).toHaveBeenCalledWith("session-1");
        expect(MissionLoopHandler.handleAbort).toHaveBeenCalledWith("session-1");
        expect(TodoContinuation.handleSessionIdle).not.toHaveBeenCalled();
        expect(MissionLoopHandler.handleMissionIdle).not.toHaveBeenCalled();
    });

    it("continues from idle only after an assistant completion for the current user turn", async () => {
        vi.useFakeTimers();
        const handler = createEventHandler(ctx);
        const session = ctx.sessions.get("session-1");
        session.lastUserMessageAt = Date.now();
        session.lastAssistantCompletedAt = session.lastUserMessageAt + 1;

        await handler({
            event: {
                type: "session.idle",
                properties: { sessionID: "session-1" },
            },
        });

        await vi.advanceTimersByTimeAsync(500);

        expect(TodoContinuation.handleSessionIdle).toHaveBeenCalledWith(
            ctx.client,
            ctx.directory,
            "session-1",
            "session-1",
        );
        expect(TodoContinuation.handleAbort).not.toHaveBeenCalled();
    });

    it("handles session.status idle through the same guarded continuation path", async () => {
        vi.useFakeTimers();
        vi.mocked(MissionLoop.isLoopActive).mockReturnValue(true);
        const handler = createEventHandler(ctx);
        const session = ctx.sessions.get("session-1");
        session.lastUserMessageAt = Date.now();
        session.lastAssistantCompletedAt = session.lastUserMessageAt + 1;

        await handler({
            event: {
                type: "session.status",
                properties: {
                    sessionID: "session-1",
                    status: { type: "idle" },
                },
            },
        });

        await vi.advanceTimersByTimeAsync(500);

        expect(MissionLoopHandler.handleMissionIdle).toHaveBeenCalledWith(
            ctx.client,
            ctx.directory,
            "session-1",
            "session-1",
        );
        expect(TodoContinuation.handleSessionIdle).not.toHaveBeenCalled();
    });
});
