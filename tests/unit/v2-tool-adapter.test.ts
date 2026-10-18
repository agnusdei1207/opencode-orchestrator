import type { ToolDefinition } from "@opencode-ai/plugin";
import type { Plugin } from "@opencode/plugin";
import { describe, expect, it, vi } from "vitest";
import { registerV2Tools } from "../../src/v2/tool-adapter.js";
import { configureStrictReview, resetStrictReview } from "../../src/core/review/strict-review.js";

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

    describe("strict review delegation tools", () => {
        function captureOptions(): { context: Plugin.Context; options: Map<string, unknown> } {
            const options = new Map<string, unknown>();
            const context = {
                location: { directory: "C:/project", project: { directory: "C:/project" } },
                tool: {
                    transform: vi.fn(async (callback: (editor: { add: (tool: { name: string; options?: unknown }) => void }) => void) => {
                        callback({ add: tool => { options.set(tool.name, tool.options); } });
                        return { dispose: async () => {} };
                    }),
                },
            } as unknown as Plugin.Context;
            return { context, options };
        }
        const tool = { description: "t", args: {}, execute: vi.fn(async () => "ok") } as unknown as ToolDefinition;

        // OpenCode 2 (core 2.0.32, Tool.snapshot) offers a tool to the model
        // directly only when `options.codemode === false`; anything else,
        // including `pinned: true`, stays inside the Code Mode catalog.
        const isDirect = (opts: unknown) => (opts as { codemode?: unknown } | undefined)?.codemode === false;

        it("exposes the delegation tools as direct tools when strictReview is enabled", async () => {
            configureStrictReview({ enabled: true });
            const { context, options } = captureOptions();
            await registerV2Tools(context, {
                delegate_task: tool,
                get_task_result: tool,
                list_tasks: tool,
                cancel_task: tool,
                grep_search: tool,
            });
            for (const name of ["delegate_task", "get_task_result", "list_tasks", "cancel_task"]) {
                expect(options.get(name), name).toEqual({ codemode: false });
                expect(isDirect(options.get(name)), name).toBe(true);
                expect(options.get(name), name).not.toHaveProperty("pinned");
            }
            expect(options.get("grep_search")).toBeUndefined();
            expect(isDirect(options.get("grep_search"))).toBe(false);
            resetStrictReview();
        });

        it("leaves every tool in Code Mode (no options) when strictReview is disabled", async () => {
            resetStrictReview();
            const { context, options } = captureOptions();
            await registerV2Tools(context, { delegate_task: tool, get_task_result: tool, grep_search: tool });
            expect([...options.values()]).toEqual([undefined, undefined, undefined]);
        });
    });
});
