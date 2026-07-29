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
import { AgentUIHook } from "../../src/hooks/custom/agent-ui";
import { SanityCheckHook } from "../../src/hooks/features/sanity-check";
import { SecretScannerHook } from "../../src/hooks/custom/secret-scanner";

import { HOOK_ACTIONS } from "../../src/hooks/constants";
import { TOOL_NAMES, type VerificationResult } from "../../src/shared";
import { state } from "../../src/core/orchestrator/state";
import { STAGNATION_INTERVENTION } from "../../src/shared/constants/system-messages.js";
import type { HookContext } from "../../src/hooks/registry";
import type { SessionState } from "../../src/core/orchestrator/state";

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
    startMissionLoop: vi.fn(),
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
    buildVerificationFailurePrompt: vi.fn().mockReturnValue("Verification failed"),
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

        it("should detect /task command", async () => {
            const result = await hook.execute(mockContext, `/task "build"`);
            expect(result.action).toBe(HOOK_ACTIONS.PROCESS);
            expect(state.missionActive).toBe(true);
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

        it("should stop if verification passes", async () => {
            state.missionActive = true;
            state.sessions.set("test-session", createSessionState());

            const { verifyMissionCompletion } = await import("../../src/core/loop/verification");
            vi.mocked(verifyMissionCompletion).mockReturnValue(createVerificationResult());

            const result = await hook.execute(mockContext, "All done");
            expect(result.action).toBe(HOOK_ACTIONS.STOP);
        });

        it("should report sync-only failures with the full verification prompt", async () => {
            state.missionActive = true;
            state.sessions.set("test-session", createSessionState());
            const verificationModule = await import("../../src/core/loop/verification");
            vi.mocked(verificationModule.verifyMissionCompletion).mockReturnValue(createVerificationResult({
                passed: false,
                syncIssuesEmpty: false,
                syncIssuesCount: 1,
                checklistPresent: false,
                checklistComplete: false,
                checklistProgress: "0/0",
                errors: ["Sync issues not resolved"],
            }));

            const result = await hook.execute(mockContext, "Done");

            expect(result.action).toBe(HOOK_ACTIONS.INJECT);
            expect(verificationModule.buildVerificationFailurePrompt).toHaveBeenCalled();
            expect(result.prompts).toContain("Verification failed");
        });

        it("should track checklist and sync changes as mission progress", async () => {
            state.missionActive = true;
            state.sessions.set("test-session", createSessionState());
            const loopState = {
                active: true,
                sessionID: "test-session",
                lastProgress: "old-progress",
                stagnationCount: 1,
            };
            const missionLoop = await import("../../src/core/loop/mission-loop");
            vi.mocked(missionLoop.readLoopState).mockReturnValue(loopState as never);
            const verificationModule = await import("../../src/core/loop/verification");
            vi.mocked(verificationModule.verifyMissionCompletion).mockReturnValue(createVerificationResult({
                passed: false,
                checklistPresent: true,
                checklistComplete: false,
                checklistProgress: "1/2",
                syncIssuesEmpty: false,
                syncIssuesCount: 1,
                errors: ["Verification incomplete"],
            }));
            vi.mocked(verificationModule.buildVerificationSummary).mockReturnValue("checklist=1/2;sync=1");

            const result = await hook.execute(mockContext, "Progress made");

            expect(result.action).toBe(HOOK_ACTIONS.INJECT);
            expect(result.prompts).not.toContain(STAGNATION_INTERVENTION);
            expect(loopState.stagnationCount).toBe(0);
            expect(loopState.lastProgress).toBe("checklist=1/2;sync=1");
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
    });

    describe("AgentUIHook", () => {
        const hook = new AgentUIHook();

        it("should decorate agent output", async () => {
            const input = { agent: "planner" };
            const output = { title: "Res", output: "Thinking...", metadata: {} };
            const result = await hook.execute(mockContext, TOOL_NAMES.CALL_AGENT, input, output);

            expect(result.output).toContain("[P] [PLANNER] Working...");
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
        const hook = new SanityCheckHook();

        it("should detect anomalies", async () => {
            const { checkOutputSanity } = await import("../../src/utils/sanity/index");
            vi.mocked(checkOutputSanity).mockReturnValue({ isHealthy: false, reason: "Loop", severity: "warning" });

            const result = await hook.execute(mockContext, TOOL_NAMES.CALL_AGENT, { agent: "worker" }, { output: "bad", title: "", metadata: {} });
            expect(result.output).toContain("ANOMALY DETECTED");
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

function createVerificationResult(overrides: Partial<VerificationResult> = {}): VerificationResult {
    return {
        passed: true,
        todoComplete: true,
        todoPresent: true,
        todoProgress: "3/3",
        todoIncomplete: 0,
        syncIssuesEmpty: true,
        syncIssuesCount: 0,
        checklistComplete: true,
        checklistPresent: true,
        checklistProgress: "1/1",
        errors: [],
        ...overrides,
    };
}
