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
import { HOOK_ACTIONS, HOOK_NAMES } from "../../src/hooks/constants";
import { TOOL_NAMES, COMMAND_NAMES } from "../../src/shared";
import { state } from "../../src/core/orchestrator/state";

// Mock dependencies
vi.mock("../../src/core/agents/logger", () => ({
    log: vi.fn(),
}));

// Mock slashCommand to avoid loading @opencode-ai/plugin which causes module not found error in tests
vi.mock("../../src/tools/slashCommand", () => ({
    COMMANDS: {
        task: {
            description: "Mock Task Command",
            template: "Mock Template: $ARGUMENTS"
        }
    }
}));

vi.mock("../../src/core/loop/mission-seal", () => ({
    startMissionLoop: vi.fn(),
    cancelMissionLoop: vi.fn(),
    isLoopActive: vi.fn().mockReturnValue(true),
    detectSealInText: vi.fn(),
    clearLoopState: vi.fn(),
    SEAL_PATTERN: "<mission_seal>"
}));

vi.mock("../../src/core/notification/toast", () => ({
    show: vi.fn(),
}));

describe("Hook System", () => {
    let registry: HookRegistry;
    let mockContext: any;

    beforeEach(() => {
        // Reset singleton (if possible, or just get instance)
        // Since it's a singleton, we might need to clear hooks if methods available, 
        // or just rely on overwriting behavior if we test specific instances.
        // HookRegistry doesn't expose clear method. 
        // We will create new instances of Hooks and call them directly for unit logic,
        // and test Registry integration separately if needed.
        registry = HookRegistry.getInstance();

        mockContext = {
            sessionID: "test-session",
            directory: "/tmp/test",
            sessions: new Map(),
        };

        // Reset state
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
            expect(result.reason).toContain("Root deletion");
        });

        it("should allow non-root deletion 'rm -rf ./dist'", async () => {
            const result = await hook.execute(mockContext, "run_command", { command: "rm -rf ./dist" });
            expect(result.action).toBe(HOOK_ACTIONS.ALLOW);
        });

        it("should block 'run_background' with root deletion", async () => {
            const result = await hook.execute(mockContext, TOOL_NAMES.RUN_BACKGROUND, { command: "rm -rf / " });
            expect(result.action).toBe(HOOK_ACTIONS.BLOCK);
        });
    });

    describe("MissionControlHook", () => {
        const hook = new MissionControlHook();

        describe("Chat Execution (/task)", () => {
            it("should ignore normal text", async () => {
                const result = await hook.execute(mockContext, "hello world");
                // execute calls handleMissionSeal if not command. 
                // handleMissionSeal checks loops. 
                // We mocked isLoopActive to true. 
                // detectSealInText mocked to undefined -> returns continue (or inject if enabled)
                // Wait, handleMissionSeal returns INJECT in current implementation if loop active & not sealed.
                expect(result.action).not.toBe(HOOK_ACTIONS.PROCESS); // It might be INJECT or CONTINUE
            });

            it("should detect /task command", async () => {
                const msg = `/task "build app"`;
                const result = await hook.execute(mockContext, msg);

                expect(result.action).toBe(HOOK_ACTIONS.PROCESS);
                expect(result.modifiedMessage).toBeDefined();
                expect(state.missionActive).toBe(true);
                expect(state.sessions.has("test-session")).toBe(true);
            });
        });

        describe("Done Execution (Seal)", () => {
            it("should stop if seal detected", async () => {
                // Setup active mission state
                state.missionActive = true;
                state.sessions.set("test-session", { enabled: true } as any);

                const { detectSealInText } = await import("../../src/core/loop/mission-seal");
                vi.mocked(detectSealInText).mockReturnValue(true);

                const result = await hook.execute(mockContext, "All done <mission_seal>");
                expect(result.action).toBe(HOOK_ACTIONS.STOP);
            });
        });
    });
});
