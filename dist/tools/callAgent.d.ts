export declare const callAgentTool: {
    description: string;
    args: {
        agent: import("zod").ZodEnum<{
            planner: "planner";
            coder: "coder";
            reviewer: "reviewer";
            fixer: "fixer";
            searcher: "searcher";
        }>;
        task: import("zod").ZodString;
        context: import("zod").ZodOptional<import("zod").ZodString>;
    };
    execute(args: {
        agent: "planner" | "coder" | "reviewer" | "fixer" | "searcher";
        task: string;
        context?: string | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
