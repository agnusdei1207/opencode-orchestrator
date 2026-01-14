export declare const callAgentTool: {
    description: string;
    args: {
        agent: import("zod").ZodEnum<{
            architect: "architect";
            builder: "builder";
            inspector: "inspector";
            recorder: "recorder";
        }>;
        task: import("zod").ZodString;
        context: import("zod").ZodOptional<import("zod").ZodString>;
    };
    execute(args: {
        agent: "architect" | "builder" | "inspector" | "recorder";
        task: string;
        context?: string | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
