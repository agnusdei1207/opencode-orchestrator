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
/**
 * Multi-grep (mgrep) tool - search multiple patterns in parallel
 * High-performance parallel search powered by Rust
 *
 * Use cases:
 * - Find all usages of multiple functions at once
 * - Search for related patterns (imports, exports, usages)
 * - Codebase-wide refactoring analysis
 */
export declare const mgrepTool: (directory: string) => {
    description: string;
    args: {
        patterns: import("zod").ZodArray<import("zod").ZodString>;
        dir: import("zod").ZodOptional<import("zod").ZodString>;
        max_results_per_pattern: import("zod").ZodOptional<import("zod").ZodNumber>;
    };
    execute(args: {
        patterns: string[];
        dir?: string | undefined;
        max_results_per_pattern?: number | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
