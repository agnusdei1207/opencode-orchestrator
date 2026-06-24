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
    });

    it("routes modifiedArgs as the final argument shape and removes stale keys", async () => {
        let argsSeenByHook: Record<string, unknown> | undefined;
        const executePreTool = vi.fn().mockImplementation(async (
            _context: unknown,
            _tool: string,
            args: Record<string, unknown>,
        ) => {
            argsSeenByHook = { ...args };
            return {
                action: HOOK_ACTIONS.MODIFY,
                modifiedArgs: {
                    command: "npm test",
                },
            };
        });
        vi.spyOn(HookRegistry, "getInstance").mockReturnValue({
            executePreTool,
        } as unknown as HookRegistry);

        const ctx = createContext();
        const input: ToolExecuteBeforeInput = {
            tool: "run_command",
            sessionID: "session-1",
            callID: "call-1",
        };
        const output: ToolExecuteBeforeOutput = {
            args: {
                command: "npm test",
                unsafeFlag: true,
            },
        };

        await createToolExecuteBeforeHandler(ctx)(input, output);

        expect(output.args).toEqual({ command: "npm test" });
        expect(argsSeenByHook).toEqual({
            command: "npm test",
            unsafeFlag: true,
        });
        expect(executePreTool).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionID: "session-1",
                directory: "/tmp/project",
            }),
            "run_command",
            expect.any(Object),
        );
    });

    it("throws when a pre-tool hook blocks the call", async () => {
        vi.spyOn(HookRegistry, "getInstance").mockReturnValue({
            executePreTool: vi.fn().mockResolvedValue({
                action: HOOK_ACTIONS.BLOCK,
                reason: "blocked by test",
            }),
        } as unknown as HookRegistry);

        await expect(createToolExecuteBeforeHandler(createContext())({
            tool: "run_command",
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
            directory: "/tmp/project",
            sessions: new Map(),
        })({
            tool: "run_command",
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
                    estimatedCost: 0,
                },
            }],
        ]),
    };
}
