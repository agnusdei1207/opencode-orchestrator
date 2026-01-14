/**
 * Slash commands for OpenCode Orchestrator
 * Simplified: Only /task and /agents are needed
 */
export declare const COMMANDS: Record<string, {
    description: string;
    template: string;
    argumentHint?: string;
}>;
export declare function createSlashcommandTool(): {
    description: string;
    args: {
        command: import("zod").ZodString;
    };
    execute(args: {
        command: string;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
