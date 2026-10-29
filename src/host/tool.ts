/**
 * Plugin tool definitions. The host adapter registers them with OpenCode 2.
 */

import { z } from "zod";

export interface ToolContext {
    sessionID: string;
    messageID: string;
    agent: string;
    /** Directory of the session that called the tool. */
    directory: string;
    worktree: string;
    abort: AbortSignal;
}

export type ToolArgs = z.ZodRawShape;

export interface ToolDefinition<Args extends ToolArgs = ToolArgs> {
    description: string;
    args: Args;
    execute(args: z.infer<z.ZodObject<Args>>, context: ToolContext): Promise<string>;
}

export function tool<Args extends ToolArgs>(definition: ToolDefinition<Args>): ToolDefinition<Args> {
    return definition;
}

tool.schema = z;
