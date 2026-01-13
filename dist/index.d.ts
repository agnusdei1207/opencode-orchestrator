/**
 * OpenCode Orchestrator Plugin
 *
 * 6-Agent Collaborative Architecture for OpenCode
 *
 * Philosophy: Cheap models (GLM-4.7, Gemma, Phi) can outperform
 * expensive models through intelligent task decomposition and
 * team collaboration with quality gates.
 */
import type { PluginInput } from "@opencode-ai/plugin";
declare const OrchestratorPlugin: (input: PluginInput) => Promise<{
    tool: {
        call_agent: {
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
        slashcommand: {
            description: string;
            args: {
                command: import("zod").ZodString;
            };
            execute(args: {
                command: string;
            }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
        };
        grep_search: {
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
        glob_search: {
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
    };
    config: (config: Record<string, unknown>) => Promise<void>;
    "chat.message": (input: any, output: any) => Promise<void>;
    "tool.execute.after": (input: {
        tool: string;
        sessionID: string;
        callID: string;
        arguments?: any;
    }, output: {
        title: string;
        output: string;
        metadata: any;
    }) => Promise<void>;
}>;
export default OrchestratorPlugin;
