import type { ToolDefinition } from "@opencode-ai/plugin";
import type { Plugin } from "@opencode/plugin";
import { z } from "zod";
import { TOOL_NAMES } from "../shared/index.js";
import { isStrictReviewEnabled } from "../core/review/strict-review.js";

type Context = Plugin.Context;

/**
 * OpenCode 2 sends every tool whose `options.codemode` is not `false` to the
 * Code Mode catalog, reachable only through `execute`; only `codemode: false`
 * tools are offered to the model directly (`pinned` merely keeps a tool listed
 * in that catalog). Strict review requires Commander to delegate through
 * delegate_task and refuses host-native subagents, so the delegation tools must
 * be direct tools or Commander has no reliable way to obtain a review.
 */
const STRICT_REVIEW_DIRECT_TOOLS = new Set<string>([
    TOOL_NAMES.DELEGATE_TASK,
    TOOL_NAMES.GET_TASK_RESULT,
    TOOL_NAMES.LIST_TASKS,
    TOOL_NAMES.CANCEL_TASK,
]);

function withExposure(name: string): { options?: { codemode: false } } {
    const options = toolOptions(name);
    return options ? { options } : {};
}

function toolOptions(name: string): { codemode: false } | undefined {
    return isStrictReviewEnabled() && STRICT_REVIEW_DIRECT_TOOLS.has(name) ? { codemode: false } : undefined;
}

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
                ...withExposure(name),
                execute: async (input, toolContext) => {
                    const result = await definition.execute(input, {
                        sessionID: toolContext.sessionID,
                        messageID: toolContext.messageID,
                        agent: toolContext.agent,
                        directory: context.location.directory,
                        worktree: context.location.project.directory,
                        abort: toolContext.signal,
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
