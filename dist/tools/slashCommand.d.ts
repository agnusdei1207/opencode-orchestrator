/**
 * Slash commands for OpenCode Orchestrator
 * - /task: Mission mode trigger with full Commander prompt
 * - /plan: Planning only
 * - /agents: Show architecture
 */
export declare const COMMANDER_SYSTEM_PROMPT: string;
export declare const MISSION_MODE_TEMPLATE: string;
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
