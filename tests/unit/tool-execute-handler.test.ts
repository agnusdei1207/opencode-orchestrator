import { beforeEach, describe, expect, it, vi } from "vitest";
import { createToolExecuteAfterHandler } from "../../src/plugin-handlers/tool-execute-handler";
import { HookRegistry } from "../../src/hooks/registry";
import {
    clearEvidence,
    getUnverifiedFiles,
} from "../../src/core/loop/evidence";
import type { ToolExecuteHandlerContext } from "../../src/plugin-handlers/context";
import type {
    ToolExecuteAfterInput,
    ToolExecuteAfterOutput,
} from "../../src/plugin-handlers/tool-execute-handler";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

describe("createToolExecuteAfterHandler", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        clearEvidence("session-1");
    });

    it("records evidence before running post-tool hooks", async () => {
        const executePostTool = vi.fn().mockImplementation(async () => {
            expect(getUnverifiedFiles("session-1")).toEqual(["src/a.ts"]);
        });
        vi.spyOn(HookRegistry, "getInstance").mockReturnValue({
            executePostTool,
        } as unknown as HookRegistry);

        const input = createToolInput();
        const output = createToolOutput();

        await createToolExecuteAfterHandler(createContext())(input, output);

        expect(executePostTool).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionID: "session-1",
                directory: "/tmp/project",
            }),
            "write",
            input.args,
            output,
        );
        expect(output.output).toContain("Step 1");
    });

    it("keeps evidence records when a post-tool hook throws", async () => {
        vi.spyOn(HookRegistry, "getInstance").mockReturnValue({
            executePostTool: vi.fn().mockRejectedValue(new Error("post hook failed")),
        } as unknown as HookRegistry);

        await expect(createToolExecuteAfterHandler(createContext())(
            createToolInput(),
            createToolOutput(),
        )).rejects.toThrow("post hook failed");

        expect(getUnverifiedFiles("session-1")).toEqual(["src/a.ts"]);
    });

    it("disables display decoration while retaining tracking and post-tool output changes", async () => {
        const executePostTool = vi.fn(async (_ctx: unknown, _tool: string, _args: Record<string, unknown>, output: ToolExecuteAfterOutput) => {
            output.output = "redacted by post-tool hook";
        });
        vi.spyOn(HookRegistry, "getInstance").mockReturnValue({ executePostTool } as unknown as HookRegistry);
        const context = createContext();
        const output = createToolOutput();
        await createToolExecuteAfterHandler(context, false)(createToolInput(), output);
        expect(output.output).toBe("redacted by post-tool hook");
        expect(context.sessions.get("session-1")?.step).toBe(1);
        expect(getUnverifiedFiles("session-1")).toEqual(["src/a.ts"]);
        expect(executePostTool).toHaveBeenCalledOnce();
    });
});

function createToolInput(): ToolExecuteAfterInput {
    return {
        tool: "write",
        sessionID: "session-1",
        callID: "call-1",
        args: {
            filePath: "src/a.ts",
        },
    };
}

function createToolOutput(): ToolExecuteAfterOutput {
    return {
        title: "write",
        output: "wrote file",
        metadata: {},
    };
}

function createContext(): ToolExecuteHandlerContext {
    return {
        client: {} as never,
        directory: "/tmp/project",
        sessions: new Map([
            ["session-1", {
                active: true,
                step: 0,
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
