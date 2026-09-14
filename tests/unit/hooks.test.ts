/**
 * Hook System Tests
 * 
 * Verifies:
 * - Registry registration and execution flow
 * - Hook interactions (Chat, PreTool, PostTool, Done)
 * - Specific Hook logic (MissionControl, StrictRoleGuard)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MissionControlHook } from "../../src/hooks/features/mission-loop";
import { StrictRoleGuardHook } from "../../src/hooks/custom/strict-role-guard";
import { ResourceControlHook } from "../../src/hooks/custom/resource-control";
import { ContextLimitResolver } from "../../src/core/context/context-limit-resolver";
import { checkContextWindow, cleanupSession } from "../../src/core/context/context-window-monitor";
import { SanityCheckHook } from "../../src/hooks/features/sanity-check";
import { SecretScannerHook } from "../../src/hooks/custom/secret-scanner";

import { HOOK_ACTIONS } from "../../src/hooks/constants";
import { state } from "../../src/core/orchestrator/state";
import type { HookContext } from "../../src/hooks/registry";
import type { SessionState } from "../../src/core/orchestrator/state";
import { queuePrompts, hasPendingPrompts } from "../../src/core/session/pending-injection";

// Mock dependencies
vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));
vi.mock("../../src/core/notification/toast", () => ({
    show: vi.fn(),
    getTaskToastManager: vi.fn().mockReturnValue({
        showMissionCompleteToast: vi.fn(),
    })
}));
vi.mock("../../src/tools/slashCommand", () => ({
    COMMANDS: { task: { description: "Mock", template: "Mock: $ARGUMENTS" } }
}));
vi.mock("../../src/core/loop/mission-loop", () => ({
    startMissionLoop: vi.fn().mockReturnValue(true),
    cancelMissionLoop: vi.fn(),
    isLoopActive: vi.fn().mockReturnValue(true),
    clearLoopState: vi.fn(),
    readLoopState: vi.fn().mockReturnValue({ active: true, sessionID: "test-session" }),
    writeLoopState: vi.fn(),
}));
vi.mock("../../src/core/loop/verification", () => ({
    verifyMissionCompletion: vi.fn().mockReturnValue({
        passed: true,
        todoComplete: true,
        todoPresent: true,
        todoProgress: "3/3",
        todoIncomplete: 0,
        syncIssuesEmpty: true,
        syncIssuesCount: 0,
        checklistComplete: false,
        checklistPresent: false,
        checklistProgress: "0/0",
        errors: []
    }),
    buildVerificationSummary: vi.fn().mockReturnValue("[Verification ✅ PASSED]")
}));
vi.mock("../../src/core/orchestrator/session-manager", async () => {
    const actual = await vi.importActual<typeof import("../../src/core/orchestrator/session-manager")>(
        "../../src/core/orchestrator/session-manager"
    );
    return {
        ...actual,
        deactivateMissionState: vi.fn(actual.deactivateMissionState),
    };
});
vi.mock("../../src/utils/sanity/index", () => ({
    checkOutputSanity: vi.fn().mockReturnValue({ isHealthy: true }),
    RECOVERY_PROMPT: "Recover",
    ESCALATION_PROMPT: "Escalate"
}));

describe("Hook System", () => {
    let mockContext: HookContext;

    beforeEach(() => {
        vi.clearAllMocks();
        mockContext = {
            sessionID: "test-session",
            directory: "/tmp/test",
            sessions: new Map(),
        };
        state.sessions.clear();
        state.missionActive = false;
    });

    describe("StrictRoleGuardHook", () => {
        const hook = new StrictRoleGuardHook();

        it("should allow safe commands", async () => {
            const result = await hook.execute(mockContext, "run_command", { command: "ls -la" });
            expect(result.action).toBe(HOOK_ACTIONS.ALLOW);
        });

        it("should block root deletion 'rm -rf /'", async () => {
            const result = await hook.execute(mockContext, "run_command", { command: "rm -rf /" });
            expect(result.action).toBe(HOOK_ACTIONS.BLOCK);
        });
    });

    describe("MissionControlHook", () => {
        const hook = new MissionControlHook();

        it("does not interpret ordinary user messages as mission completion", async () => {
            state.missionActive = true;
            state.sessions.set("test-session", createSessionState());
            const missionLoop = await import("../../src/core/loop/mission-loop");
            const result = await hook.execute(mockContext, "Also check the deployment wiring before finishing");
            expect(result).toEqual({ action: HOOK_ACTIONS.PROCESS });
            expect(missionLoop.clearLoopState).not.toHaveBeenCalled();
            expect(missionLoop.writeLoopState).not.toHaveBeenCalled();
        });

        it("should detect /task command", async () => {
            const result = await hook.execute(mockContext, `/task "build"`);
            expect(result.action).toBe(HOOK_ACTIONS.PROCESS);
            expect(state.missionActive).toBe(true);
        });

        it("reactivates a locally cancelled session on the next /task", async () => {
            mockContext.sessions.set("test-session", { active: false });
            await hook.execute(mockContext, "/task new goal");
            expect((mockContext.sessions.get("test-session") as { active: boolean }).active).toBe(true);
        });

        it("does not announce activation when mission persistence fails", async () => {
            const { startMissionLoop } = await import("../../src/core/loop/mission-loop");
            vi.mocked(startMissionLoop).mockReturnValueOnce(false);
            await expect(hook.execute(mockContext, "/task new goal")).rejects.toThrow("persist");
            expect(state.missionActive).toBe(false);
        });

        it("should intercept /cancel and deactivate mission state", async () => {
            state.missionActive = true;
            state.sessions.set("test-session", createSessionState());
            mockContext.sessions.set("test-session", { active: true });

            const { cancelMissionLoop } = await import("../../src/core/loop/mission-loop");
            const { deactivateMissionState } = await import("../../src/core/orchestrator/session-manager");

            const result = await hook.execute(mockContext, "/cancel");

            expect(result.action).toBe(HOOK_ACTIONS.INTERCEPT);
            expect(cancelMissionLoop).toHaveBeenCalledWith("/tmp/test", "test-session");
            expect(deactivateMissionState).toHaveBeenCalledWith("test-session");
            const session = mockContext.sessions.get("test-session") as { active: boolean };
            expect(session.active).toBe(false);
        });

        it("discards already queued continuation when the user types /stop", async () => {
            const session = { active: true, lastAbortAt: undefined as number | undefined };
            mockContext.sessions.set("test-session", session);
            queuePrompts("test-session", ["Continue the old turn"]);
            await hook.execute(mockContext, "/stop");
            expect(hasPendingPrompts("test-session")).toBe(false);
            expect(session.lastAbortAt).toBeDefined();
        });

    });

    describe("ResourceControlHook", () => {
        const hook = new ResourceControlHook();

        it("should track tokens", async () => {
            const result = await hook.execute(
                mockContext,
                "tool",
                { prompt: "input" },
                { title: "tool", output: "output", metadata: {} }
            );
            const session = mockContext.sessions.get("test-session") as {
                tokens: { totalInput: number; active?: unknown };
            };
            expect(result).toEqual({});
            expect(session.tokens.totalInput).toBeGreaterThan(0);
            expect(session.tokens.active).not.toBeDefined(); // should be session root
        });

        it("should inject compaction prompt only on assistant completion", async () => {
            mockContext.sessions.set("test-session", {
                tokens: { totalInput: 180000, totalOutput: 0, estimatedCost: 0 },
            });

            const postResult = await hook.execute(
                mockContext,
                "tool",
                { prompt: "input" },
                { title: "tool", output: "output", metadata: {} }
            );
            const doneResult = await hook.execute(mockContext, "final response");

            expect(postResult).toEqual({});
            expect(doneResult.action).toBe(HOOK_ACTIONS.INJECT);
        });

        it("measures the character estimate against the model's own window (issue #40)", async () => {
            const resolver = ContextLimitResolver.getInstance();
            resolver.reset();
            resolver.rememberModel("test-session", "zai", "glm-5.3", 1_000_000);
            mockContext.sessions.set("test-session", {
                tokens: { totalInput: 180000, totalOutput: 0, estimatedCost: 0 },
            });

            const doneResult = await hook.execute(mockContext, "final response");

            expect(doneResult.action).toBe(HOOK_ACTIONS.CONTINUE);
            resolver.reset();
        });

        it("prefers the host-reported token usage over the character estimate", async () => {
            const freshHook = new ResourceControlHook();
            mockContext.sessions.set("test-session", {
                tokens: { totalInput: 180000, totalOutput: 0, estimatedCost: 0 },
            });
            // The host says the model is at 10% of a 1M window; the estimate says 90% of 200k.
            checkContextWindow("test-session", 100_000, 1_000_000);

            const doneResult = await freshHook.execute(mockContext, "final response");

            expect(doneResult.action).toBe(HOOK_ACTIONS.CONTINUE);
            cleanupSession("test-session");
        });
    });

    describe("SecretScannerHook", () => {
        const hook = new SecretScannerHook();

        it("should redact secrets", async () => {
            const secret = "Items: ghp_000000000000000000000000000000000000";
            const output = { title: "Res", output: secret, metadata: {} };
            const result = await hook.execute(mockContext, "tool", {}, output);

            expect(result.output).toContain("REDACTED");
            expect(result.output).not.toContain("ghp_000000000000000000000000000000000000");
        });
    });

    describe("SanityCheckHook", () => {
        async function mockedSanity(severity: string) {
            const { checkOutputSanity } = await import("../../src/utils/sanity/index");
            vi.mocked(checkOutputSanity).mockReturnValue({ isHealthy: false, reason: "Loop", severity });
        }

        function assistantOutput(hook: SanityCheckHook, sessionID: string) {
            return hook.execute(
                { ...mockContext, sessionID },
                "bad",
            );
        }

        it("should detect anomalies", async () => {
            await mockedSanity("critical");

            const result = await assistantOutput(new SanityCheckHook(), "sanity-critical");
            expect(result).toEqual({
                action: HOOK_ACTIONS.INJECT,
                prompts: [expect.stringContaining("ANOMALY #1")],
            });
        });

        // Issue #35: acting on an anomaly injects another turn, so only
        // CRITICAL findings are worth that cost. A WARNING is
        // logged and dropped.
        it("ignores non-critical findings", async () => {
            await mockedSanity("warning");

            const result = await assistantOutput(new SanityCheckHook(), "sanity-warning");
            expect(result).toEqual({ action: HOOK_ACTIONS.CONTINUE });
        });

        it("suppresses repeat interventions within the cooldown window", async () => {
            await mockedSanity("critical");
            const hook = new SanityCheckHook();

            const first = await assistantOutput(hook, "sanity-cooldown");
            const second = await assistantOutput(hook, "sanity-cooldown");

            expect(first.action).toBe(HOOK_ACTIONS.INJECT);
            expect(second, "a misfiring detector must not fire every turn").toEqual({ action: HOOK_ACTIONS.CONTINUE });
        });

        it("tracks the cooldown per session", async () => {
            await mockedSanity("critical");
            const hook = new SanityCheckHook();

            const first = await assistantOutput(hook, "sanity-session-a");
            const other = await assistantOutput(hook, "sanity-session-b");

            expect(first.action).toBe(HOOK_ACTIONS.INJECT);
            expect(other.action).toBe(HOOK_ACTIONS.INJECT);
        });
    });
});

function createSessionState(overrides: Partial<SessionState> = {}): SessionState {
    return {
        enabled: true,
        iterations: 0,
        taskRetries: new Map(),
        currentTask: "",
        anomalyCount: 0,
        ...overrides,
    };
}
