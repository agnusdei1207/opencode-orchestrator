import type { Plugin } from "@opencode/plugin";
import { describe, expect, it, vi } from "vitest";
import { tool, type ToolContext, type ToolDefinition } from "../../src/host/tool.js";
import { registerTools } from "../../src/host/tool-adapter.js";

type AddedTool = {
    name: string;
    description?: string;
    input?: unknown;
    options?: { codemode?: boolean };
    execute: (input: object, context: object) => Promise<unknown>;
};

function createHost() {
    const added: AddedTool[] = [];
    const context = {
        location: { directory: "C:/project/sub", project: { directory: "C:/project" } },
        tool: {
            transform: vi.fn(async (callback: (editor: { add: (tool: AddedTool) => void }) => void) => {
                callback({ add: definition => { added.push(definition); } });
                return { dispose: async () => {} };
            }),
        },
    } as unknown as Plugin.Context;
    return { context, added };
}

describe("OpenCode 2 tool adapter", () => {
    it("passes the host cancellation signal to a delegated tool", async () => {
        const controller = new AbortController();
        let receivedSignal: AbortSignal | undefined;
        const delegate = tool({
            description: "Capture cancellation",
            args: {},
            execute: vi.fn(async (_input, context) => {
                receivedSignal = context.abort;
                return "done";
            }),
        });
        const { context, added } = createHost();

        await registerTools(context, { delegate_task: delegate as ToolDefinition });
        expect(added).toHaveLength(1);
        await added[0].execute({}, {
            sessionID: "session-1", messageID: "message-1", agent: "Worker",
            signal: controller.signal, progress: vi.fn(),
        });

        expect(receivedSignal).toBe(controller.signal);
        controller.abort();
        expect(receivedSignal?.aborted).toBe(true);
    });

    it("maps the host tool context and wraps the string result as content", async () => {
        let received: ToolContext | undefined;
        let receivedArgs: unknown;
        const echo = tool({
            description: "Echo",
            args: { text: tool.schema.string() },
            execute: async (args, context) => {
                received = context;
                receivedArgs = args;
                return `echo:${args.text}`;
            },
        });
        const { context, added } = createHost();
        const signal = new AbortController().signal;

        await registerTools(context, { echo: echo as unknown as ToolDefinition });
        const result = await added[0].execute({ text: "hi" }, {
            sessionID: "session-1", messageID: "message-1", agent: "Worker", signal, progress: vi.fn(),
        });

        expect(result).toEqual({ content: "echo:hi" });
        expect(receivedArgs).toEqual({ text: "hi" });
        expect(received).toEqual({
            sessionID: "session-1",
            messageID: "message-1",
            agent: "Worker",
            directory: "C:/project/sub",
            worktree: "C:/project",
            abort: signal,
        });
        expect(added[0].description).toBe("Echo");
        expect(added[0].input).toMatchObject({
            type: "object",
            properties: { text: { type: "string" } },
            required: ["text"],
        });
    });

    // OpenCode 2 hides tools without `codemode: false` inside the code-mode
    // catalog, so a direct call such as update_todo fails with "No tool named".
    it("registers every tool as a direct tool, like OpenCode's built-in tools", async () => {
        const definition = tool({ description: "Direct tool", args: {}, execute: async () => "" });
        const { context, added } = createHost();

        await registerTools(context, { update_todo: definition, delegate_task: definition });

        expect(added.map(entry => [entry.name, entry.options])).toEqual([
            ["update_todo", { codemode: false }],
            ["delegate_task", { codemode: false }],
        ]);
    });
});
