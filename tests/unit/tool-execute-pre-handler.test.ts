import { beforeEach, describe, expect, it, vi } from "vitest";
import { createToolExecuteBeforeHandler } from "../../src/plugin-handlers/tool-execute-pre-handler";
import { HookRegistry } from "../../src/hooks/registry";
import { HOOK_ACTIONS } from "../../src/hooks/constants";
import type { ToolExecuteHandlerContext } from "../../src/plugin-handlers/context";
import type {
    ToolExecuteBeforeInput,
    ToolExecuteBeforeOutput,
} from "../../src/plugin-handlers/tool-execute-pre-handler";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

describe("createToolExecuteBeforeHandler", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        (HookRegistry as unknown as { instance?: HookRegistry }).instance = undefined;
    });

    it("passes the call to the registry and leaves allowed arguments untouched", async () => {
        let observed: unknown;
        HookRegistry.getInstance().registerPreTool({
            name: "observe",
            execute: async (context, tool, args) => {
                observed = { sessionID: context.sessionID, callID: context.callID, directory: context.directory, tool, args: { ...args } };
                return { action: HOOK_ACTIONS.ALLOW };
            },
        });
        const input: ToolExecuteBeforeInput = {
            tool: "bash",
            sessionID: "session-1",
            callID: "call-1",
        };
        const output: ToolExecuteBeforeOutput = {
            args: { command: "original", unsafeFlag: true },
        };

        await createToolExecuteBeforeHandler(createContext())(input, output);

        expect(output.args).toEqual({ command: "original", unsafeFlag: true });
        expect(observed).toEqual({
            sessionID: "session-1",
            callID: "call-1",
            directory: "/tmp/project",
            tool: "bash",
            args: { command: "original", unsafeFlag: true },
        });
    });

    it("blocks a fork bomb through the owned role guard", async () => {
        const { StrictRoleGuardHook } = await import("../../src/hooks/custom/strict-role-guard");
        HookRegistry.getInstance().registerPreTool(new StrictRoleGuardHook(), "stop");

        await expect(createToolExecuteBeforeHandler(createContext())({
            tool: "bash",
            sessionID: "session-1",
            callID: "call-1",
        }, {
            args: { command: ":(){ :|:& };:" },
        })).rejects.toThrow(/Action Blocked/);
    });

    it("throws when a pre-tool hook blocks the call", async () => {
        vi.spyOn(HookRegistry, "getInstance").mockReturnValue({
            executePreTool: vi.fn().mockResolvedValue({
                action: HOOK_ACTIONS.BLOCK,
                reason: "blocked by test",
            }),
        } as unknown as HookRegistry);

        await expect(createToolExecuteBeforeHandler(createContext())({
            tool: "bash",
            sessionID: "session-1",
            callID: "call-1",
        }, {
            args: { command: "rm -rf /" },
        })).rejects.toThrow("blocked by test");
    });

    it("does not run hooks for inactive sessions", async () => {
        const executePreTool = vi.fn();
        vi.spyOn(HookRegistry, "getInstance").mockReturnValue({
            executePreTool,
        } as unknown as HookRegistry);

        await createToolExecuteBeforeHandler({
            client: {} as never,
            directory: "/tmp/project",
            sessions: new Map(),
        })({
            tool: "bash",
            sessionID: "missing-session",
            callID: "call-1",
        }, {
            args: { command: "ls" },
        });

        expect(executePreTool).not.toHaveBeenCalled();
    });
});

function createContext(): ToolExecuteHandlerContext {
    return {
        client: {} as never,
        directory: "/tmp/project",
        sessions: new Map([
            ["session-1", {
                active: true,
                step: 0,
                timestamp: 0,
                startTime: 0,
                lastStepTime: 0,
                tokens: {
                    totalInput: 0,
                    totalOutput: 0,
                },
            }],
        ]),
    };
}
