/**
 * Background Task Tools for OpenCode Orchestrator
 *
 * These tools allow the AI to run commands in the background and check their results later.
 * This is useful for long-running builds, tests, or other operations.
 */
export declare const runBackgroundTool: {
    description: string;
    args: {
        command: import("zod").ZodString;
        cwd: import("zod").ZodOptional<import("zod").ZodString>;
        timeout: import("zod").ZodOptional<import("zod").ZodNumber>;
        label: import("zod").ZodOptional<import("zod").ZodString>;
        sessionID: import("zod").ZodOptional<import("zod").ZodString>;
    };
    execute(args: {
        command: string;
        cwd?: string | undefined;
        timeout?: number | undefined;
        label?: string | undefined;
        sessionID?: string | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
export declare const checkBackgroundTool: {
    description: string;
    args: {
        taskId: import("zod").ZodString;
        tailLines: import("zod").ZodOptional<import("zod").ZodNumber>;
    };
    execute(args: {
        taskId: string;
        tailLines?: number | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
export declare const listBackgroundTool: {
    description: string;
    args: {
        status: import("zod").ZodOptional<import("zod").ZodEnum<{
            running: "running";
            done: "done";
            error: "error";
            all: "all";
        }>>;
    };
    execute(args: {
        status?: "running" | "done" | "error" | "all" | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
export declare const killBackgroundTool: {
    description: string;
    args: {
        taskId: import("zod").ZodString;
    };
    execute(args: {
        taskId: string;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
