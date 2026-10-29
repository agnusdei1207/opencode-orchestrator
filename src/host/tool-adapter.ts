import type { ToolDefinition } from "./tool.js";
import type { Plugin } from "@opencode/plugin";
import { z } from "zod";

type Context = Plugin.Context;

export async function registerTools(
    context: Context,
    tools: Record<string, ToolDefinition>,
): Promise<Awaited<ReturnType<Context["tool"]["transform"]>>> {
    return context.tool.transform(editor => {
        for (const [name, definition] of Object.entries(tools)) {
            editor.add({
                name,
                // Without this, OpenCode 2 puts the tool in the code-mode catalog
                // behind `execute`, and a direct call fails with "No tool named".
                // OpenCode's own built-in tools register the same way.
                options: { codemode: false },
                description: definition.description,
                input: z.toJSONSchema(z.object(definition.args)),
                execute: async (input, toolContext) => ({
                    content: await definition.execute(input as never, {
                        sessionID: toolContext.sessionID,
                        messageID: toolContext.messageID,
                        agent: toolContext.agent,
                        directory: context.location.directory,
                        worktree: context.location.project.directory,
                        abort: toolContext.signal,
                    }),
                }),
            });
        }
    });
}
