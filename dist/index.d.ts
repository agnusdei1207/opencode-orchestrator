/**
 * OpenCode Orchestrator Plugin
 *
 * This is the main entry point for the 5-Agent structured architecture.
 * We've optimized it for weaker models by using:
 * - XML-structured prompts with clear boundaries
 * - Explicit reasoning patterns (THINK -> ACT -> OBSERVE -> ADJUST)
 * - Evidence-based completion requirements
 * - Autonomous execution loop that keeps going until done
 *
 * The agents are: Commander, Architect, Builder, Inspector, Recorder
 */
import type { PluginInput } from "@opencode-ai/plugin";
declare const OrchestratorPlugin: (input: PluginInput) => Promise<{
    tool: {
        call_agent: {
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
    "chat.message": (msgInput: any, msgOutput: any) => Promise<void>;
    "tool.execute.after": (toolInput: {
        tool: string;
        sessionID: string;
        callID: string;
        arguments?: any;
    }, toolOutput: {
        title: string;
        output: string;
        metadata: any;
    }) => Promise<void>;
    "assistant.done": (assistantInput: any, assistantOutput: any) => Promise<void>;
    handler: ({ event }: {
        event: {
            type: string;
            properties?: unknown;
        };
    }) => Promise<void>;
}>;
export default OrchestratorPlugin;
