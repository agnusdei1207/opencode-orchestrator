/**
 * Task Delegation Tools
 *
 * Tools for delegating work to agents:
 * - delegate_task: Delegate work to an agent (sync or background)
 * - get_task_result: Retrieve completed task result
 * - list_tasks: View all parallel tasks
 * - cancel_task: Stop a running task
 */
import { type ToolDefinition } from "@opencode-ai/plugin";
import { ParallelAgentManager } from "../core/async-agent.js";
export { ParallelAgentManager as AsyncAgentManager } from "../core/async-agent.js";
/**
 * delegate_task - Delegate work to an agent (sync or background)
 */
export declare const createDelegateTaskTool: (manager: ParallelAgentManager, client: unknown) => {
    description: string;
    args: {
        agent: import("zod").ZodString;
        description: import("zod").ZodString;
        prompt: import("zod").ZodString;
        background: import("zod").ZodBoolean;
    };
    execute(args: {
        agent: string;
        description: string;
        prompt: string;
        background: boolean;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<string>;
};
/**
 * get_task_result - Get result from a completed background task
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
 * list_tasks - List all background tasks
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
 * cancel_task - Cancel a running background task
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
 * Factory function to create all task delegation tools
 */
export declare function createAsyncAgentTools(manager: ParallelAgentManager, client?: unknown): Record<string, ToolDefinition>;
