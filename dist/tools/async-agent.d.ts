/**
 * Parallel Agent Tools
 *
 * Tools for spawning and managing parallel agent sessions:
 * - spawn_agent: Launch agent in parallel session
 * - get_task_result: Retrieve completed task result
 * - list_tasks: View all parallel tasks
 * - cancel_task: Stop a running task
 */
import { type ToolDefinition } from "@opencode-ai/plugin";
import { ParallelAgentManager } from "../core/async-agent.js";
export { ParallelAgentManager as AsyncAgentManager } from "../core/async-agent.js";
/**
 * spawn_agent - Launch an agent in a parallel session
 */
export declare const createSpawnAgentTool: (manager: ParallelAgentManager) => {
    description: string;
    args: {
        agent: import("zod").ZodString;
        description: import("zod").ZodString;
        prompt: import("zod").ZodString;
    };
    execute(args: {
        agent: string;
        description: string;
        prompt: string;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
/**
 * get_task_result - Get result from a completed parallel task
 */
export declare const createGetTaskResultTool: (manager: ParallelAgentManager) => {
    description: string;
    args: {
        taskId: import("zod").ZodString;
    };
    execute(args: {
        taskId: string;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
/**
 * list_tasks - List all parallel tasks
 */
export declare const createListTasksTool: (manager: ParallelAgentManager) => {
    description: string;
    args: {
        status: import("zod").ZodOptional<import("zod").ZodString>;
    };
    execute(args: {
        status?: string | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
/**
 * cancel_task - Cancel a running parallel task
 */
export declare const createCancelTaskTool: (manager: ParallelAgentManager) => {
    description: string;
    args: {
        taskId: import("zod").ZodString;
    };
    execute(args: {
        taskId: string;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
/**
 * Factory function to create all parallel agent tools
 */
export declare function createAsyncAgentTools(manager: ParallelAgentManager): Record<string, ToolDefinition>;
