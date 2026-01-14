/**
 * OpenCode Orchestrator Plugin
 *
 * 5-Agent Structured Architecture for OpenCode
 *
 * Optimized for weak models (GLM-4.7, Gemma, Phi) through:
 * - XML-structured prompts with clear boundaries
 * - Explicit reasoning patterns (THINK → ACT → OBSERVE → ADJUST)
 * - Evidence-based completion requirements
 * - Parallel execution by default
 *
 * Agents: Commander, Architect, Builder, Inspector, Memory
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
    "assistant.done": (input: any, output: any) => Promise<void>;
}>;
export default OrchestratorPlugin;
