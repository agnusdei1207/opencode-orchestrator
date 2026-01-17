export declare const callAgentTool: {
    description: string;
    args: {
        agent: import("zod").ZodEnum<{
            Planner: "Planner";
            Worker: "Worker";
            Reviewer: "Reviewer";
        }>;
        task: import("zod").ZodString;
        context: import("zod").ZodOptional<import("zod").ZodString>;
    };
    execute(args: {
        agent: "Planner" | "Worker" | "Reviewer";
        task: string;
        context?: string | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
