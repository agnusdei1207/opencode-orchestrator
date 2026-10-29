import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEventHandler } from "../../src/plugin-handlers/event-handler";
import { handleCompletedAssistantMessage } from "../../src/plugin-handlers/assistant-done-handler";
import * as SessionRecovery from "../../src/core/recovery/session-recovery";
import * as ContextMonitor from "../../src/core/context";
import { ContextLimitResolver } from "../../src/core/context/context-limit-resolver";
import { CONTEXT_MONITOR_CONFIG } from "../../src/core/context/context-window-monitor";
import * as MissionLoopHandler from "../../src/core/loop/mission-loop-handler";
import * as MissionLoop from "../../src/core/loop/mission-loop";
import * as SessionActivity from "../../src/core/session/activity";
import * as PendingInjection from "../../src/core/session/pending-injection";
import { log } from "../../src/shared/logger";
import { ChildSessions } from "../../src/core/session/child-sessions";
import { HookRegistry } from "../../src/hooks/registry";
import type { EventHandlerContext } from "../../src/plugin-handlers/event-handler";

vi.mock("../../src/core/recovery/session-recovery", () => ({
    cleanupSessionRecovery: vi.fn(),
    handleSessionError: vi.fn(),
    markRecoveryComplete: vi.fn(),
}));
vi.mock("../../src/core/loop/mission-loop-handler", () => ({
    handleSessionCompacted: vi.fn(),
    cleanupSession: vi.fn(),
    handleAbort: vi.fn(),
    handleUserMessage: vi.fn(),
    handleSessionBusy: vi.fn(),
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
vi.mock("../../src/shared/logger", () => ({ log: vi.fn() }));

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
                    tokens: { totalInput: 0, totalOutput: 0 },
                }],
            ]),
            children: new ChildSessions(),
            contextLimits: new ContextLimitResolver(),
        };
        vi.clearAllMocks();
        vi.mocked(MissionLoop.isLoopActive).mockReturnValue(false);
    });

    afterEach(() => {
        vi.useRealTimers();
        SessionActivity.resetSessionActivity();
        PendingInjection.resetPendingInjections();
    });

    it("records compaction only on the completed host event with a session id", async () => {
        const handler = createEventHandler(ctx);
        await handler({ event: { type: "session.compacted", properties: { sessionID: "session-1" } } });
        await handler({ event: { type: "session.compacted", properties: {} } });
        expect(MissionLoopHandler.handleSessionCompacted).toHaveBeenCalledExactlyOnceWith("session-1");
    });

    it("keeps an explicit abort effective across a late completed-message event and repeated idles", async () => {
        vi.useFakeTimers();
        const prompt = vi.fn().mockResolvedValue(undefined);
        ctx.client = { prompt, statuses: () => new Map() } as never;
        const session = ctx.sessions.get("session-1")!;
        session.lastAssistantCompletedAt = Date.now() - 100;
        PendingInjection.queuePrompts("session-1", ["Continue unfinished mission"]);
        const handler = createEventHandler(ctx);
        await handler({ event: { type: "session.error", properties: { sessionID: "session-1", error: { name: "MessageAbortedError" } } } });
        expect(session.lastAbortAt).toBeDefined();
        expect(PendingInjection.hasPendingPrompts("session-1")).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        await handler({ event: { type: "message.updated", properties: { info: {
            id: "late-message", sessionID: "session-1", role: "assistant", time: { completed: Date.now() },
        } } } });
        await handler({ event: { type: "session.idle", properties: { sessionID: "session-1" } } });
        await handler({ event: { type: "session.idle", properties: { sessionID: "session-1" } } });
        await vi.advanceTimersByTimeAsync(1000);
        expect(prompt).not.toHaveBeenCalled();
        expect(MissionLoopHandler.handleMissionIdle).not.toHaveBeenCalled();
    });

    it("does not pause the mission on a non-abort session error", async () => {
        vi.useFakeTimers();
        vi.mocked(MissionLoop.isLoopActive).mockReturnValue(true);
        const session = ctx.sessions.get("session-1")!;
        session.lastUserMessageAt = Date.now();
        session.lastAssistantCompletedAt = session.lastUserMessageAt + 1;
        const error = { name: "UnknownError", message: "tool_result_missing" };
        const handler = createEventHandler(ctx);

        await handler({ event: { type: "session.error", properties: { sessionID: "session-1", error } } });

        expect(MissionLoopHandler.handleSessionBusy).toHaveBeenCalledWith("session-1");
        expect(MissionLoopHandler.handleAbort).not.toHaveBeenCalled();
        expect(session.lastAbortAt).toBeUndefined();
        expect(SessionRecovery.handleSessionError).toHaveBeenCalledWith(ctx.client, "session-1", error);

        await handler({ event: { type: "session.idle", properties: { sessionID: "session-1" } } });
        await vi.advanceTimersByTimeAsync(500);
        expect(MissionLoopHandler.handleMissionIdle).toHaveBeenCalledOnce();
    });

    it.each(["AbortError", "MessageAbortedError"])("pauses the mission on %s", async (name) => {
        vi.useFakeTimers();
        vi.mocked(MissionLoop.isLoopActive).mockReturnValue(true);
        const session = ctx.sessions.get("session-1")!;
        session.lastUserMessageAt = Date.now();
        session.lastAssistantCompletedAt = session.lastUserMessageAt + 1;
        const handler = createEventHandler(ctx);

        await handler({ event: { type: "session.error", properties: { sessionID: "session-1", error: { name } } } });

        expect(MissionLoopHandler.handleAbort).toHaveBeenCalledWith("session-1");
        expect(session.lastAbortAt).toBeDefined();
        expect(SessionRecovery.handleSessionError).not.toHaveBeenCalled();

        await handler({ event: { type: "session.idle", properties: { sessionID: "session-1" } } });
        await vi.advanceTimersByTimeAsync(500);
        expect(MissionLoopHandler.handleMissionIdle).not.toHaveBeenCalled();
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
        await vi.waitFor(() => expect(ContextMonitor.checkContextWindow)
            .toHaveBeenCalledWith("session-1", 15, CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS));
        expect(handleCompletedAssistantMessage).toHaveBeenCalledWith(ctx, "session-1", "message-1");
        expect(ctx.sessions.get("session-1")!.lastAssistantCompletedAt).toBeGreaterThan(0);
    });

    it("measures context against the model's own window and counts cached tokens (issue #40)", async () => {
        ctx.contextLimits.rememberModel("session-1", "zai", "glm-5.3", 1_000_000);
        const handler = createEventHandler(ctx);

        await handler({
            event: {
                type: "message.updated",
                properties: {
                    info: {
                        id: "message-1",
                        sessionID: "session-1",
                        role: "assistant",
                        providerID: "zai",
                        modelID: "glm-5.3",
                        tokens: { input: 100, output: 20, reasoning: 7, cache: { read: 300, write: 50 } },
                    },
                },
            },
        });

        await vi.waitFor(() => expect(ContextMonitor.checkContextWindow).toHaveBeenCalledWith("session-1", 470, 1_000_000));
    });

    it("resolves the window from the session's remembered model when the step carries none", async () => {
        const lookup = vi.fn().mockResolvedValue(400_000);
        ctx.contextLimits = new ContextLimitResolver({ lookup });
        ctx.contextLimits.rememberModel("session-1", "anthropic", "claude-x");
        const resolveSession = vi.spyOn(ctx.contextLimits, "resolveSession");
        const resolve = vi.spyOn(ctx.contextLimits, "resolve");
        const handler = createEventHandler(ctx);

        await handler({ event: { type: "message.updated", properties: { info: {
            id: "step-1", sessionID: "session-1", role: "assistant", tokens: { input: 1000, output: 200 },
        } } } });

        await vi.waitFor(() => expect(ContextMonitor.checkContextWindow).toHaveBeenCalledWith("session-1", 1200, 400_000));
        expect(resolveSession).toHaveBeenCalledWith("session-1");
        expect(lookup).toHaveBeenCalledWith("anthropic", "claude-x");
        // resolveSession delegates to resolve with the remembered model, never an empty one.
        expect(resolve).toHaveBeenCalledWith("anthropic", "claude-x");
        expect(resolve).not.toHaveBeenCalledWith(undefined, undefined);
    });

    it("registers a child session from session.created and forgets it on delete", async () => {
        const statuses = new Map([["child-1", "busy"]]);
        ctx.client = { statuses: () => statuses } as never;
        const clearSession = vi.spyOn(HookRegistry.getInstance(), "clearSession");
        const handler = createEventHandler(ctx);

        await handler({ event: { type: "session.created", properties: { sessionID: "child-1", parentID: "session-1" } } });
        expect(ctx.children.busyChildren(ctx.client, "session-1")).toEqual(["child-1"]);

        await handler({ event: { type: "session.deleted", properties: { sessionID: "child-1" } } });
        expect(ctx.children.busyChildren(ctx.client, "session-1")).toEqual([]);
        expect(clearSession).toHaveBeenCalledWith("child-1");
        clearSession.mockRestore();
    });

    it("does not register a session created without a parent", async () => {
        ctx.client = { statuses: () => new Map([["root-2", "busy"]]) } as never;
        await createEventHandler(ctx)({ event: { type: "session.created", properties: { sessionID: "root-2" } } });
        expect(ctx.children.busyChildren(ctx.client, "")).toEqual([]);
        expect(ctx.children.busyChildren(ctx.client, "root-2")).toEqual([]);
    });

    it("forgets the children of a deleted parent and clears hook state for it", async () => {
        ctx.client = { statuses: () => new Map([["child-1", "busy"]]) } as never;
        ctx.children.add("session-1", "child-1");
        const clearSession = vi.spyOn(HookRegistry.getInstance(), "clearSession");

        await createEventHandler(ctx)({ event: { type: "session.deleted", properties: { sessionID: "session-1" } } });

        expect(ctx.children.busyChildren(ctx.client, "session-1")).toEqual([]);
        expect(clearSession).toHaveBeenCalledWith("session-1");
        clearSession.mockRestore();
    });

    it("reads session ids from info.id for deleted events", async () => {
        const handler = createEventHandler(ctx);

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

        expect(ctx.sessions.has("session-1")).toBe(false);
        expect(SessionRecovery.cleanupSessionRecovery).toHaveBeenCalledWith("session-1");
        expect(MissionLoopHandler.cleanupSession).toHaveBeenCalledWith("session-1");
        expect(ContextMonitor.cleanupSession).toHaveBeenCalledWith("session-1");
    });

    it("prefers a direct sessionID over nested info.id for session lifecycle events", async () => {
        const handler = createEventHandler(ctx);

        ctx.sessions.set("session-direct", {
            active: true,
            step: 0,
            startTime: Date.now(),
            lastStepTime: 0,
            tokens: { totalInput: 0, totalOutput: 0 },
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

        expect(ctx.sessions.has("session-direct")).toBe(false);
        expect(ctx.sessions.has("session-nested")).toBe(false);
        expect(SessionRecovery.cleanupSessionRecovery).toHaveBeenCalledWith("session-direct");
        expect(SessionRecovery.cleanupSessionRecovery).not.toHaveBeenCalledWith("session-nested");
    });

    it("clears queued prompts and activity when an untracked session is deleted", async () => {
        const handler = createEventHandler(ctx);
        SessionActivity.recordSessionStatus("untracked-session", "busy");
        PendingInjection.queueNotice("untracked-session", "Background task finished");

        await handler({
            event: {
                type: "session.deleted",
                properties: { sessionID: "untracked-session" },
            },
        });

        expect(SessionActivity.isKnownBusy("untracked-session")).toBe(false);
        expect(PendingInjection.hasPendingPrompts("untracked-session")).toBe(false);
    });

    it("releases per-session state for untracked sessions on delete", async () => {
        const forgetSession = vi.spyOn(ctx.contextLimits, "forgetSession");
        const handler = createEventHandler(ctx);

        await handler({ event: { type: "session.deleted", properties: { sessionID: "child-session" } } });

        expect(SessionRecovery.cleanupSessionRecovery).toHaveBeenCalledWith("child-session");
        expect(ContextMonitor.cleanupSession).toHaveBeenCalledWith("child-session");
        expect(MissionLoopHandler.cleanupSession).toHaveBeenCalledWith("child-session");
        expect(forgetSession).toHaveBeenCalledWith("child-session");
    });

    it("treats idle without an assistant completion after the user turn as an abort", async () => {
        vi.useFakeTimers();
        const handler = createEventHandler(ctx);
        ctx.sessions.get("session-1")!.lastUserMessageAt = Date.now();

        await handler({
            event: {
                type: "session.idle",
                properties: { sessionID: "session-1" },
            },
        });

        await vi.advanceTimersByTimeAsync(500);

        expect(MissionLoopHandler.handleAbort).toHaveBeenCalledWith("session-1");
        expect(MissionLoopHandler.handleMissionIdle).not.toHaveBeenCalled();
    });

    it("still delivers a later background notice after an idle it declined", async () => {
        vi.useFakeTimers();
        const prompt = vi.fn().mockResolvedValue(undefined);
        ctx.client = { prompt, statuses: () => new Map() } as never;
        const session = ctx.sessions.get("session-1")!;
        session.lastUserMessageAt = Date.now();
        const handler = createEventHandler(ctx);

        await handler({ event: { type: "session.idle", properties: { sessionID: "session-1" } } });
        await vi.advanceTimersByTimeAsync(500);
        expect(session.lastAbortAt).toBeUndefined();

        PendingInjection.queueNotice("session-1", "Background task finished");
        await handler({ event: { type: "session.idle", properties: { sessionID: "session-1" } } });
        await vi.advanceTimersByTimeAsync(500);

        expect(prompt).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
            sessionID: "session-1", text: expect.stringContaining("Background task finished"),
        }));
        expect(PendingInjection.hasPendingPrompts("session-1")).toBe(false);
    });

    it("marks a session busy on a non-idle status without scheduling continuation", async () => {
        vi.useFakeTimers();
        vi.mocked(MissionLoop.isLoopActive).mockReturnValue(true);
        const handler = createEventHandler(ctx);

        await handler({ event: { type: "session.status", properties: { sessionID: "session-1", status: { type: "busy" } } } });
        await vi.advanceTimersByTimeAsync(500);

        expect(SessionActivity.isKnownBusy("session-1")).toBe(true);
        expect(MissionLoopHandler.handleSessionBusy).toHaveBeenCalledExactlyOnceWith("session-1");
        expect(MissionLoopHandler.handleMissionIdle).not.toHaveBeenCalled();
    });

    it("does not continue a session that does not own the project mission", async () => {
        vi.useFakeTimers();
        const handler = createEventHandler(ctx);
        const session = ctx.sessions.get("session-1")!;
        session.lastUserMessageAt = Date.now();
        session.lastAssistantCompletedAt = session.lastUserMessageAt + 1;

        await handler({
            event: {
                type: "session.idle",
                properties: { sessionID: "session-1" },
            },
        });

        await vi.advanceTimersByTimeAsync(500);

        expect(MissionLoopHandler.handleMissionIdle).not.toHaveBeenCalled();
    });

    it("handles session.status idle through the same guarded continuation path", async () => {
        vi.useFakeTimers();
        vi.mocked(MissionLoop.isLoopActive).mockReturnValue(true);
        const handler = createEventHandler(ctx);
        const session = ctx.sessions.get("session-1")!;
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
            { client: ctx.client, directory: ctx.directory, tasks: { hasBusyChildren: expect.any(Function) } },
            "session-1",
            "session-1",
        );
    });

    it("answers the mission loop's busy-children question from child sessions and host status", async () => {
        vi.useFakeTimers();
        vi.mocked(MissionLoop.isLoopActive).mockReturnValue(true);
        const statuses = new Map<string, string>();
        ctx.client = { prompt: vi.fn(), statuses: () => statuses } as never;
        const session = ctx.sessions.get("session-1")!;
        session.lastUserMessageAt = Date.now();
        session.lastAssistantCompletedAt = session.lastUserMessageAt + 1;
        const handler = createEventHandler(ctx);

        await handler({ event: { type: "session.created", properties: { sessionID: "child-1", parentID: "session-1" } } });
        await handler({ event: { type: "session.idle", properties: { sessionID: "session-1" } } });
        await vi.advanceTimersByTimeAsync(500);

        const source = vi.mocked(MissionLoopHandler.handleMissionIdle).mock.calls[0][0].tasks!;
        expect(source.hasBusyChildren("session-1")).toBe(false);
        statuses.set("child-1", "busy");
        expect(source.hasBusyChildren("session-1")).toBe(true);
        expect(source.hasBusyChildren("other-parent")).toBe(false);
        statuses.delete("child-1");
        expect(source.hasBusyChildren("session-1")).toBe(false);
    });

    it("runs one idle continuation when the host reports idle through both events", async () => {
        vi.useFakeTimers();
        vi.mocked(MissionLoop.isLoopActive).mockReturnValue(true);
        const handler = createEventHandler(ctx);
        const session = ctx.sessions.get("session-1")!;
        session.lastUserMessageAt = Date.now();
        session.lastAssistantCompletedAt = session.lastUserMessageAt + 1;

        // OpenCode publishes session.status(idle) and session.idle for the same transition.
        await handler({ event: { type: "session.status", properties: { sessionID: "session-1", status: { type: "idle" } } } });
        await handler({ event: { type: "session.idle", properties: { sessionID: "session-1" } } });
        await vi.advanceTimersByTimeAsync(500);

        expect(MissionLoopHandler.handleMissionIdle).toHaveBeenCalledOnce();
    });

    it("logs idle continuation failures without breaking the timer callback", async () => {
        vi.useFakeTimers();
        vi.mocked(MissionLoop.isLoopActive).mockReturnValue(true);
        vi.mocked(MissionLoopHandler.handleMissionIdle).mockRejectedValueOnce(new Error("idle failed"));
        const handler = createEventHandler(ctx);
        const session = ctx.sessions.get("session-1")!;
        session.lastUserMessageAt = Date.now();
        session.lastAssistantCompletedAt = session.lastUserMessageAt + 1;

        await handler({
            event: {
                type: "session.idle",
                properties: { sessionID: "session-1" },
            },
        });

        await vi.advanceTimersByTimeAsync(500);

        expect(log).toHaveBeenCalledWith(expect.stringContaining("idle continuation failed for session-1"));
    });
});
