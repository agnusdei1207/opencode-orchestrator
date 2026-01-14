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
