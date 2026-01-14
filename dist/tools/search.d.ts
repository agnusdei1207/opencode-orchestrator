/**
 * Grep search tool - finds patterns in code
 * Used by Builder and Inspector for codebase analysis
 */
export declare const grepSearchTool: (directory: string) => {
    description: string;
    args: {
        pattern: import("zod").ZodString;
        dir: import("zod").ZodOptional<import("zod").ZodString>;
    };
    execute(args: {
        pattern: string;
        dir?: string | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
/**
 * Glob search tool - finds files by pattern
 * Used by Builder and Recorder for file discovery
 */
export declare const globSearchTool: (directory: string) => {
    description: string;
    args: {
        pattern: import("zod").ZodString;
        dir: import("zod").ZodOptional<import("zod").ZodString>;
    };
    execute(args: {
        pattern: string;
        dir?: string | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
