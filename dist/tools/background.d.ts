export declare const runBackgroundTool: {
    description: string;
    args: {
        command: import("zod").ZodString;
        cwd: import("zod").ZodOptional<import("zod").ZodString>;
        timeout: import("zod").ZodOptional<import("zod").ZodNumber>;
        label: import("zod").ZodOptional<import("zod").ZodString>;
    };
    execute(args: {
        command: string;
        cwd?: string | undefined;
        timeout?: number | undefined;
        label?: string | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
export declare const checkBackgroundTool: {
    description: string;
    args: {
        task_id: import("zod").ZodString;
        tail_lines: import("zod").ZodOptional<import("zod").ZodNumber>;
    };
    execute(args: {
        task_id: string;
        tail_lines?: number | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
export declare const listBackgroundTool: {
    description: string;
    args: {
        status: import("zod").ZodOptional<import("zod").ZodEnum<{
            running: "running";
            all: "all";
            done: "done";
            error: "error";
        }>>;
    };
    execute(args: {
        status?: "running" | "all" | "done" | "error" | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
export declare const killBackgroundTool: {
    description: string;
    args: {
        task_id: import("zod").ZodString;
    };
    execute(args: {
        task_id: string;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
