import { beforeEach, describe, expect, it, vi } from "vitest";
import { createToolExecuteAfterHandler } from "../../src/plugin-handlers/tool-execute-handler";
import { HookRegistry } from "../../src/hooks/registry";
import {
    clearCircuitState,
    getCircuitState,
} from "../../src/core/loop/circuit-breaker";
import {
    clearEvidence,
    getChangedFiles,
} from "../../src/core/loop/evidence";
import type { ToolExecuteHandlerContext } from "../../src/plugin-handlers/interfaces/tool-execute-context";
import type { ToolHookInput, ToolHookOutput } from "../../src/plugin-handlers/interfaces/tool-hook";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

describe("createToolExecuteAfterHandler", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        clearCircuitState("session-1");
        clearEvidence("session-1");
    });

    it("records tool calls and evidence before running post-tool hooks", async () => {
        const executePostTool = vi.fn().mockImplementation(async () => {
            expect(getCircuitState("session-1")?.toolCallHistory).toEqual(["write"]);
            expect(getChangedFiles("session-1")).toEqual(["src/a.ts"]);
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
            input.arguments,
            output,
        );
        expect(output.output).toContain("Step 1");
    });

    it("keeps tool call and evidence records when a post-tool hook throws", async () => {
        vi.spyOn(HookRegistry, "getInstance").mockReturnValue({
            executePostTool: vi.fn().mockRejectedValue(new Error("post hook failed")),
        } as unknown as HookRegistry);

        await expect(createToolExecuteAfterHandler(createContext())(
            createToolInput(),
            createToolOutput(),
        )).rejects.toThrow("post hook failed");

        expect(getCircuitState("session-1")?.toolCallHistory).toEqual(["write"]);
        expect(getChangedFiles("session-1")).toEqual(["src/a.ts"]);
    });
});

function createToolInput(): ToolHookInput {
    return {
        tool: "write",
        sessionID: "session-1",
        callID: "call-1",
        arguments: {
            filePath: "src/a.ts",
        },
    };
}

function createToolOutput(): ToolHookOutput {
    return {
        title: "write",
        output: "wrote file",
        metadata: {},
    };
}

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
