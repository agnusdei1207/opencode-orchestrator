import type { ToolDefinition } from "@opencode-ai/plugin";
import type { Plugin } from "@opencode/plugin";
import { z } from "zod";

type Context = Plugin.Context;

export async function registerV2Tools(
    context: Context,
    tools: Record<string, ToolDefinition>,
): Promise<Awaited<ReturnType<Context["tool"]["transform"]>>> {
    return context.tool.transform(editor => {
        for (const [name, definition] of Object.entries(tools)) {
            editor.add({
                name,
                description: definition.description,
                input: z.toJSONSchema(z.object(definition.args)),
                execute: async (input, toolContext) => {
                    const result = await definition.execute(input, {
                        sessionID: toolContext.sessionID,
                        messageID: toolContext.messageID,
                        agent: toolContext.agent,
                        directory: context.location.directory,
                        worktree: context.location.project.directory,
                        abort: new AbortController().signal,
                        metadata: update => void toolContext.progress(update.metadata ?? {}),
                        ask: async () => {
                            throw new Error("Interactive tool permission requests are unavailable in OpenCode 2 plugins");
                        },
                    });
                    return convertResult(result);
                },
            });
        }
    });
}

function convertResult(result: Awaited<ReturnType<ToolDefinition["execute"]>>) {
    if (typeof result === "string") return { content: result };
    return {
        content: result.output,
        metadata: result.metadata,
    };
}
