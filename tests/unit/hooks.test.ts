/**
 * Hook System Tests
 * 
 * Verifies:
 * - Registry registration and execution flow
 * - Hook interactions (Chat, PreTool, PostTool, Done)
 * - Specific Hook logic (MissionControl, StrictRoleGuard)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { HookRegistry } from "../../src/hooks/registry";
import { MissionControlHook } from "../../src/hooks/features/mission-loop";
import { StrictRoleGuardHook } from "../../src/hooks/custom/strict-role-guard";
import { ResourceControlHook } from "../../src/hooks/custom/resource-control";
import { AgentUIHook } from "../../src/hooks/custom/agent-ui";
import { SanityCheckHook } from "../../src/hooks/features/sanity-check";
import { SecretScannerHook } from "../../src/hooks/custom/secret-scanner";

import { HOOK_ACTIONS } from "../../src/hooks/constants";
import { TOOL_NAMES } from "../../src/shared";
import { state } from "../../src/core/orchestrator/state";
import { updateSessionTokens, recordAnomaly } from "../../src/core/orchestrator/session-manager";
import { MISSION_MESSAGES } from "../../src/shared/constants/system-messages.js";

// Mock dependencies
vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));
vi.mock("../../src/core/notification/toast", () => ({ show: vi.fn() }));
vi.mock("../../src/tools/slashCommand", () => ({
    COMMANDS: { task: { description: "Mock", template: "Mock: $ARGUMENTS" } }
}));
vi.mock("../../src/core/loop/mission-seal", () => ({
    startMissionLoop: vi.fn(),
    cancelMissionLoop: vi.fn(),
    isLoopActive: vi.fn().mockReturnValue(true),
    detectSealInText: vi.fn(),
    clearLoopState: vi.fn(),
    SEAL_PATTERN: "<mission_seal>"
}));
vi.mock("../../src/utils/sanity/index", () => ({
    checkOutputSanity: vi.fn().mockReturnValue({ isHealthy: true }),
    RECOVERY_PROMPT: "Recover",
    ESCALATION_PROMPT: "Escalate"
}));

describe("Hook System", () => {
    let mockContext: any;

    beforeEach(() => {
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

        it("should stopping if seal detected", async () => {
            state.missionActive = true;
            state.sessions.set("test-session", { enabled: true } as any);

            const { detectSealInText } = await import("../../src/core/loop/mission-seal");
            vi.mocked(detectSealInText).mockReturnValue(true);

            const result = await hook.execute(mockContext, "All done <mission_seal>");
            expect(result.action).toBe(HOOK_ACTIONS.STOP);
        });
    });

    describe("ResourceControlHook", () => {
        const hook = new ResourceControlHook();

        it("should track tokens", async () => {
            await hook.execute(mockContext, "tool", "input", "output");
            const session = mockContext.sessions.get("test-session");
            expect(session.tokens.totalInput).toBeGreaterThan(0);
            expect(session.tokens.active).not.toBeDefined(); // should be session root
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
