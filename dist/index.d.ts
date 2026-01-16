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
        mgrep: {
            description: string;
            args: {
                patterns: import("zod").ZodArray<import("zod").ZodString>;
                dir: import("zod").ZodOptional<import("zod").ZodString>;
            };
            execute(args: {
                patterns: string[];
                dir?: string | undefined;
            }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
        };
        run_background: {
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
        check_background: {
            description: string;
            args: {
                taskId: import("zod").ZodString;
                tailLines: import("zod").ZodOptional<import("zod").ZodNumber>;
            };
            execute(args: {
                taskId: string;
                tailLines?: number | undefined;
            }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
        };
        list_background: {
            description: string;
            args: {
                status: import("zod").ZodOptional<import("zod").ZodEnum<{
                    running: "running";
                    error: "error";
                    done: "done";
                    all: "all";
                }>>;
            };
            execute(args: {
                status?: "running" | "error" | "done" | "all" | undefined;
            }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
        };
        kill_background: {
            description: string;
            args: {
                taskId: import("zod").ZodString;
            };
            execute(args: {
                taskId: string;
            }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
        };
        webfetch: {
            description: string;
            args: {
                url: import("zod").ZodString;
                cache: import("zod").ZodOptional<import("zod").ZodBoolean>;
                selector: import("zod").ZodOptional<import("zod").ZodString>;
            };
            execute(args: {
                url: string;
                cache?: boolean | undefined;
                selector?: string | undefined;
            }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
        };
        websearch: {
            description: string;
            args: {
                query: import("zod").ZodString;
                maxResults: import("zod").ZodOptional<import("zod").ZodNumber>;
            };
            execute(args: {
                query: string;
                maxResults?: number | undefined;
            }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
        };
        cache_docs: {
            description: string;
            args: {
                action: import("zod").ZodEnum<{
                    list: "list";
                    get: "get";
                    clear: "clear";
                    stats: "stats";
                }>;
                filename: import("zod").ZodOptional<import("zod").ZodString>;
            };
            execute(args: {
                action: "list" | "get" | "clear" | "stats";
                filename?: string | undefined;
            }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
        };
        codesearch: {
            description: string;
            args: {
                query: import("zod").ZodString;
                language: import("zod").ZodOptional<import("zod").ZodString>;
                repo: import("zod").ZodOptional<import("zod").ZodString>;
            };
            execute(args: {
                query: string;
                language?: string | undefined;
                repo?: string | undefined;
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
