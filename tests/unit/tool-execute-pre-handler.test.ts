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

    it.each([{ command: "npm test" }, {}])("routes real registry replacements to the host and removes stale keys: %j", async (modifiedArgs) => {
        let observed: unknown;
        HookRegistry.getInstance().registerPreTool({
            name: "replace-arguments",
            execute: async (context, tool, args) => {
                observed = { sessionID: context.sessionID, directory: context.directory, tool, args: { ...args } };
                return { action: HOOK_ACTIONS.MODIFY, modifiedArgs };
            },
        });
        const input: ToolExecuteBeforeInput = {
            tool: "run_command",
            sessionID: "session-1",
            callID: "call-1",
        };
        const output: ToolExecuteBeforeOutput = {
            args: { command: "original", unsafeFlag: true },
        };

        await createToolExecuteBeforeHandler(createContext())(input, output);

        expect(output.args).toEqual(modifiedArgs);
        expect(observed).toEqual({
            sessionID: "session-1",
            directory: "/tmp/project",
            tool: "run_command",
            args: { command: "original", unsafeFlag: true },
        });
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
