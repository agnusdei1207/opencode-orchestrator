export declare const callAgentTool: {
    description: string;
    args: {
        agent: import("zod").ZodEnum<{
            Architect: "Architect";
            Builder: "Builder";
            Inspector: "Inspector";
            Recorder: "Recorder";
        }>;
        task: import("zod").ZodString;
        context: import("zod").ZodOptional<import("zod").ZodString>;
    };
    execute(args: {
        agent: "Architect" | "Builder" | "Inspector" | "Recorder";
        task: string;
        context?: string | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
