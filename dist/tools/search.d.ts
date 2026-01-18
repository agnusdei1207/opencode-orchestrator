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
/**
 * Sed replace tool - find and replace patterns in files
 * Used for bulk code migrations and refactoring
 */
export declare const sedReplaceTool: (directory: string) => {
    description: string;
    args: {
        pattern: import("zod").ZodString;
        replacement: import("zod").ZodString;
        file: import("zod").ZodOptional<import("zod").ZodString>;
        dir: import("zod").ZodOptional<import("zod").ZodString>;
        dry_run: import("zod").ZodOptional<import("zod").ZodBoolean>;
        backup: import("zod").ZodOptional<import("zod").ZodBoolean>;
    };
    execute(args: {
        pattern: string;
        replacement: string;
        file?: string | undefined;
        dir?: string | undefined;
        dry_run?: boolean | undefined;
        backup?: boolean | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
/**
 * Diff tool - compare files or strings
 */
export declare const diffTool: () => {
    description: string;
    args: {
        file1: import("zod").ZodOptional<import("zod").ZodString>;
        file2: import("zod").ZodOptional<import("zod").ZodString>;
        content1: import("zod").ZodOptional<import("zod").ZodString>;
        content2: import("zod").ZodOptional<import("zod").ZodString>;
        ignore_whitespace: import("zod").ZodOptional<import("zod").ZodBoolean>;
    };
    execute(args: {
        file1?: string | undefined;
        file2?: string | undefined;
        content1?: string | undefined;
        content2?: string | undefined;
        ignore_whitespace?: boolean | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
/**
 * JQ tool - JSON query and manipulation
 */
export declare const jqTool: () => {
    description: string;
    args: {
        json_input: import("zod").ZodOptional<import("zod").ZodString>;
        file: import("zod").ZodOptional<import("zod").ZodString>;
        expression: import("zod").ZodString;
        raw_output: import("zod").ZodOptional<import("zod").ZodBoolean>;
    };
    execute(args: {
        expression: string;
        json_input?: string | undefined;
        file?: string | undefined;
        raw_output?: boolean | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
/**
 * HTTP tool - make HTTP requests (curl-like)
 */
export declare const httpTool: () => {
    description: string;
    args: {
        url: import("zod").ZodString;
        method: import("zod").ZodOptional<import("zod").ZodString>;
        headers: import("zod").ZodOptional<import("zod").ZodObject<{}, import("zod/v4/core").$strip>>;
        body: import("zod").ZodOptional<import("zod").ZodString>;
        timeout_ms: import("zod").ZodOptional<import("zod").ZodNumber>;
    };
    execute(args: {
        url: string;
        method?: string | undefined;
        headers?: Record<string, never> | undefined;
        body?: string | undefined;
        timeout_ms?: number | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
/**
 * File stats tool - analyze directory/file statistics
 */
export declare const fileStatsTool: (directory: string) => {
    description: string;
    args: {
        dir: import("zod").ZodOptional<import("zod").ZodString>;
        max_depth: import("zod").ZodOptional<import("zod").ZodNumber>;
    };
    execute(args: {
        dir?: string | undefined;
        max_depth?: number | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
/**
 * Git diff tool - show uncommitted changes
 */
export declare const gitDiffTool: (directory: string) => {
    description: string;
    args: {
        dir: import("zod").ZodOptional<import("zod").ZodString>;
        staged_only: import("zod").ZodOptional<import("zod").ZodBoolean>;
    };
    execute(args: {
        dir?: string | undefined;
        staged_only?: boolean | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
/**
 * Git status tool - show repository status
 */
export declare const gitStatusTool: (directory: string) => {
    description: string;
    args: {
        dir: import("zod").ZodOptional<import("zod").ZodString>;
    };
    execute(args: {
        dir?: string | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
