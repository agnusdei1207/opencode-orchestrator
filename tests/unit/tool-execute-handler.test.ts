import { beforeEach, describe, expect, it, vi } from "vitest";
import { createToolExecuteBeforeHandler } from "../../src/plugin-handlers/tool-execute-pre-handler";
import { createToolExecuteAfterHandler } from "../../src/plugin-handlers/tool-execute-handler";
import { HookRegistry } from "../../src/hooks/registry";
import { HOOK_ACTIONS } from "../../src/hooks/constants";
import type { SessionState, ToolExecuteHandlerContext } from "../../src/plugin-handlers/interfaces";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));
vi.mock("../../src/core/loop/circuit-breaker", () => ({ recordToolCall: vi.fn() }));
vi.mock("../../src/core/loop/evidence", () => ({ recordToolEvidence: vi.fn() }));

function createSession(): SessionState {
    const now = Date.now();
    return {
        active: true,
        step: 0,
        timestamp: now,
        startTime: now - 1000,
        lastStepTime: now - 500,
        tokens: { totalInput: 0, totalOutput: 0, estimatedCost: 0 },
    };
}

function createContext(session: SessionState): ToolExecuteHandlerContext {
    return {
        directory: "/tmp/test",
        sessions: new Map([["session-1", session]]),
    };
}

describe("tool execute handlers", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("passes before-hook output args to pre-tool hooks and applies modified args", async () => {
        const ctx = createContext(createSession());
        const output = { args: { command: "pwd" } };

        vi.spyOn(HookRegistry.getInstance(), "executePreTool").mockResolvedValue({
            action: HOOK_ACTIONS.MODIFY,
            modifiedArgs: { command: "pwd && npm test" },
        });

        await createToolExecuteBeforeHandler(ctx)(
            { sessionID: "session-1", callID: "call-1", tool: "bash" },
            output,
        );

        expect(HookRegistry.getInstance().executePreTool).toHaveBeenCalledWith(
            expect.objectContaining({ sessionID: "session-1", directory: "/tmp/test" }),
            "bash",
            { command: "pwd && npm test" },
        );
        expect(output.args).toEqual({ command: "pwd && npm test" });
    });

    it("throws when pre-tool hooks block an SDK before-hook call", async () => {
        const ctx = createContext(createSession());

        vi.spyOn(HookRegistry.getInstance(), "executePreTool").mockResolvedValue({
            action: HOOK_ACTIONS.BLOCK,
            reason: "blocked",
        });

        await expect(createToolExecuteBeforeHandler(ctx)(
            { sessionID: "session-1", callID: "call-1", tool: "bash" },
            { args: { command: "rm -rf /" } },
        )).rejects.toThrow("blocked");
    });

    it("passes after-hook input args to post-tool hooks", async () => {
        const session = createSession();
        const ctx = createContext(session);
        const output = { title: "done", output: "ok", metadata: {} };

        vi.spyOn(HookRegistry.getInstance(), "executePostTool").mockResolvedValue(undefined);

        await createToolExecuteAfterHandler(ctx)(
            { sessionID: "session-1", callID: "call-1", tool: "bash", args: { command: "npm test" } },
            output,
        );

        expect(HookRegistry.getInstance().executePostTool).toHaveBeenCalledWith(
            expect.objectContaining({ sessionID: "session-1", directory: "/tmp/test" }),
            "bash",
            { command: "npm test" },
            expect.objectContaining({ title: "done" }),
        );
        expect(session.step).toBe(1);
        expect(output.output).toContain("Step 1");
    });
});
