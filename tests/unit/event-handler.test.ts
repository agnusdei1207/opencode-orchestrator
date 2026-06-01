import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEventHandler } from "../../src/plugin-handlers/event-handler";
import { handleCompletedAssistantMessage } from "../../src/plugin-handlers/assistant-done-handler";
import * as SessionRecovery from "../../src/core/recovery/session-recovery";
import * as ContextMonitor from "../../src/core/context";

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
    handleSessionError: vi.fn(),
    handleUserMessage: vi.fn(),
    handleSessionIdle: vi.fn(),
}));
vi.mock("../../src/core/loop/mission-loop-handler", () => ({
    cleanupSession: vi.fn(),
    handleAbort: vi.fn(),
    handleUserMessage: vi.fn(),
    handleMissionIdle: vi.fn(),
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
    let ctx: any;

    beforeEach(() => {
        ctx = {
            client: {},
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

    it("routes completed assistant messages through the done-hook bridge", async () => {
        const handler = createEventHandler(ctx);

        await handler({
            event: {
                type: "message.updated",
                properties: {
                    sessionID: "session-1",
                    info: {
                        id: "message-1",
                        sessionID: "session-1",
                        role: "assistant",
                        time: { completed: Date.now() },
                    },
                    usage: {
                        inputTokens: 10,
                        outputTokens: 5,
                    },
                },
            },
        });

        expect(SessionRecovery.markRecoveryComplete).toHaveBeenCalledWith("session-1");
        expect(ContextMonitor.checkContextWindow).toHaveBeenCalledWith("session-1", 15);
        expect(handleCompletedAssistantMessage).toHaveBeenCalledWith(ctx, "session-1", "message-1");
    });
});
