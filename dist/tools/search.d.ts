/**
 * Grep search tool - finds patterns in code
 * Used by Worker and Reviewer for codebase analysis
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
 * Used by Worker and Reviewer for file discovery
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
/**
 * Multi-grep (mgrep) tool - search multiple patterns
 * Runs grep for each pattern and combines results
 */
export declare const mgrepTool: (directory: string) => {
    description: string;
    args: {
        patterns: import("zod").ZodArray<import("zod").ZodString>;
        dir: import("zod").ZodOptional<import("zod").ZodString>;
    };
    execute(args: {
        patterns: string[];
        dir?: string | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
