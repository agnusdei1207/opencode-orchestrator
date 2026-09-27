import type { ToolDefinition } from "@opencode-ai/plugin";
import type { Plugin } from "@opencode/plugin";
import { describe, expect, it, vi } from "vitest";
import { registerV2Tools } from "../../src/v2/tool-adapter.js";

describe("OpenCode 2 tool adapter", () => {
    it("passes the host cancellation signal to a delegated tool", async () => {
        const controller = new AbortController();
        let receivedSignal: AbortSignal | undefined;
        let execute: ((input: object, context: object) => Promise<unknown>) | undefined;
        const legacyTool = {
            description: "Capture cancellation",
            args: {},
            execute: vi.fn(async (_input: object, context: { abort: AbortSignal }) => {
                receivedSignal = context.abort;
                return "done";
            }),
        } as unknown as ToolDefinition;
        const context = {
            location: { directory: "C:/project", project: { directory: "C:/project" } },
            tool: {
                transform: vi.fn(async (callback: (editor: { add: (tool: { execute: typeof execute }) => void }) => void) => {
                    callback({ add: tool => { execute = tool.execute; } });
                    return { dispose: async () => {} };
                }),
            },
        } as unknown as Plugin.Context;

        await registerV2Tools(context, { delegate_task: legacyTool });
        expect(execute).toBeDefined();
        await execute?.({}, {
            sessionID: "session-1", messageID: "message-1", agent: "Worker",
            signal: controller.signal, progress: vi.fn(),
        });

        expect(receivedSignal).toBe(controller.signal);
        controller.abort();
        expect(receivedSignal?.aborted).toBe(true);
    });
});
