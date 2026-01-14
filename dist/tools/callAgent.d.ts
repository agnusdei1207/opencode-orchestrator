export declare const callAgentTool: {
    description: string;
    args: {
        agent: import("zod").ZodEnum<{
            architect: "architect";
            builder: "builder";
            inspector: "inspector";
            memory: "memory";
        }>;
        task: import("zod").ZodString;
        context: import("zod").ZodOptional<import("zod").ZodString>;
    };
    execute(args: {
        agent: "architect" | "builder" | "inspector" | "memory";
        task: string;
        context?: string | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
