/**
 * Parallel Agent Tools
 * 
 * Tools for spawning and managing parallel agent sessions:
 * - spawn_agent: Launch agent in parallel session
 * - get_task_result: Retrieve completed task result
 * - list_tasks: View all parallel tasks
 * - cancel_task: Stop a running task
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import { ParallelAgentManager, type ParallelTask } from "../core/async-agent.js";

// Re-export for backward compatibility
export { ParallelAgentManager as AsyncAgentManager } from "../core/async-agent.js";

/**
 * spawn_agent - Launch an agent in a parallel session
 */
export const createSpawnAgentTool = (manager: ParallelAgentManager) => tool({
    description: `Spawn an agent to run in a parallel session.

<purpose>
Launch an agent in a separate session that runs concurrently with your work.
Perfect for delegating tasks while continuing other analysis.
</purpose>

<safety>
- Max 3 agents per type (queued if at limit)
- Auto-timeout after 30 minutes
- Auto-cleanup from memory after 5 minutes
- System batches notifications (notifies when ALL complete)
</safety>

<workflow>
1. spawn_agent({ agent: "builder", ... }) → Returns task ID immediately
2. Continue your work (agent runs in background)
3. System notifies when ALL spawned agents complete
4. get_task_result({ taskId }) → Retrieve the result
</workflow>

<concurrency>
If you spawn 3 "builder" agents at limit, the 4th will queue
and start when a slot opens. Different agent types have separate limits.
</concurrency>`,
    args: {
        agent: tool.schema.string().describe("Agent name (e.g., 'builder', 'inspector', 'architect')"),
        description: tool.schema.string().describe("Short task description"),
        prompt: tool.schema.string().describe("Full prompt/instructions for the agent"),
    },
    async execute(args, context) {
        const { agent, description, prompt } = args;
        const ctx = context as { sessionID: string };

        try {
            const task = await manager.launch({
                agent,
                description,
                prompt,
                parentSessionID: ctx.sessionID,
            });

            const runningCount = manager.getRunningTasks().length;
            const pendingCount = manager.getPendingCount(ctx.sessionID);

            // Console log for visibility
            console.log(`[parallel] 🚀 SPAWNED ${task.id} → ${agent}: ${description}`);

            return `
╔═══════════════════════════════════════════════════════════════╗
║  🚀 PARALLEL AGENT SPAWNED                                    ║
╠═══════════════════════════════════════════════════════════════╣
║  Task ID:     ${task.id.padEnd(45)}║
║  Agent:       ${task.agent.padEnd(45)}║
║  Description: ${task.description.slice(0, 45).padEnd(45)}║
║  Status:      ⏳ RUNNING                                       ║
╠═══════════════════════════════════════════════════════════════╣
║  Running: ${String(runningCount).padEnd(5)} │ Pending: ${String(pendingCount).padEnd(5)}                      ║
╚═══════════════════════════════════════════════════════════════╝

📌 Continue your work! System notifies when ALL complete.
🔍 Use \`get_task_result({ taskId: "${task.id}" })\` later.`;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.log(`[parallel] ❌ FAILED: ${message}`);
            return `❌ Failed to spawn agent: ${message}`;
        }
    },
});

/**
 * get_task_result - Get result from a completed parallel task
 */
export const createGetTaskResultTool = (manager: ParallelAgentManager) => tool({
    description: `Get the result from a completed parallel task.

<note>
If the task is still running, returns status info.
Wait for the "All Complete" notification before checking.
</note>`,
    args: {
        taskId: tool.schema.string().describe("Task ID from spawn_agent (e.g., 'task_a1b2c3d4')"),
    },
    async execute(args) {
        const { taskId } = args;
        const task = manager.getTask(taskId);

        if (!task) {
            return `❌ Task not found: \`${taskId}\`

Use \`list_tasks\` to see available tasks.`;
        }

        if (task.status === "running") {
            const elapsed = Math.floor((Date.now() - task.startedAt.getTime()) / 1000);
            return `⏳ **Task Still Running**

| Property | Value |
|----------|-------|
| **Task ID** | \`${taskId}\` |
| **Agent** | ${task.agent} |
| **Elapsed** | ${elapsed}s |

Wait for "All Complete" notification, then try again.`;
        }

        const result = await manager.getResult(taskId);
        const duration = manager.formatDuration(task.startedAt, task.completedAt);

        if (task.status === "error" || task.status === "timeout") {
            return `❌ **Task ${task.status === "timeout" ? "Timed Out" : "Failed"}**

| Property | Value |
|----------|-------|
| **Task ID** | \`${taskId}\` |
| **Agent** | ${task.agent} |
| **Error** | ${task.error} |
| **Duration** | ${duration} |`;
        }

        return `✅ **Task Completed**

| Property | Value |
|----------|-------|
| **Task ID** | \`${taskId}\` |
| **Agent** | ${task.agent} |
| **Duration** | ${duration} |

---

**Result:**

${result || "(No output)"}`;
    },
});

/**
 * list_tasks - List all parallel tasks
 */
export const createListTasksTool = (manager: ParallelAgentManager) => tool({
    description: `List all parallel tasks and their status.`,
    args: {
        status: tool.schema.string().optional().describe("Filter: 'all', 'running', 'completed', 'error'"),
    },
    async execute(args) {
        const { status = "all" } = args;
        let tasks: ParallelTask[];

        switch (status) {
            case "running":
                tasks = manager.getRunningTasks();
                break;
            case "completed":
                tasks = manager.getAllTasks().filter(t => t.status === "completed");
                break;
            case "error":
                tasks = manager.getAllTasks().filter(t => t.status === "error" || t.status === "timeout");
                break;
            default:
                tasks = manager.getAllTasks();
        }

        if (tasks.length === 0) {
            return `📋 No parallel tasks found${status !== "all" ? ` (filter: ${status})` : ""}.

Use \`spawn_agent\` to launch agents in parallel.`;
        }

        const runningCount = manager.getRunningTasks().length;
        const completedCount = manager.getAllTasks().filter(t => t.status === "completed").length;
        const errorCount = manager.getAllTasks().filter(t => t.status === "error" || t.status === "timeout").length;

        const statusIcon = (s: string) => {
            switch (s) {
                case "running": return "⏳";
                case "completed": return "✅";
                case "error": return "❌";
                case "timeout": return "⏱️";
                default: return "❓";
            }
        };

        const rows = tasks.map(t => {
            const elapsed = Math.floor((Date.now() - t.startedAt.getTime()) / 1000);
            const desc = t.description.length > 25 ? t.description.slice(0, 22) + "..." : t.description;
            return `| \`${t.id}\` | ${statusIcon(t.status)} ${t.status} | ${t.agent} | ${desc} | ${elapsed}s |`;
        }).join("\n");

        return `📋 **Parallel Tasks** (${tasks.length} shown)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| ⏳ Running: ${runningCount} | ✅ Completed: ${completedCount} | ❌ Error: ${errorCount} |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Task ID | Status | Agent | Description | Elapsed |
|---------|--------|-------|-------------|---------|
${rows}

💡 Use \`get_task_result({ taskId: "task_xxx" })\` to get results.
🛑 Use \`cancel_task({ taskId: "task_xxx" })\` to stop a running task.`;
    },
});

/**
 * cancel_task - Cancel a running parallel task
 */
export const createCancelTaskTool = (manager: ParallelAgentManager) => tool({
    description: `Cancel a running parallel task.

<purpose>
Stop a runaway or no-longer-needed task.
Frees up concurrency slot for other tasks.
</purpose>`,
    args: {
        taskId: tool.schema.string().describe("Task ID to cancel (e.g., 'task_a1b2c3d4')"),
    },
    async execute(args) {
        const { taskId } = args;
        const cancelled = await manager.cancelTask(taskId);

        if (cancelled) {
            return `🛑 **Task Cancelled**

Task \`${taskId}\` has been stopped. Concurrency slot released.`;
        }

        const task = manager.getTask(taskId);
        if (task) {
            return `⚠️ Cannot cancel: Task \`${taskId}\` is ${task.status} (not running).`;
        }

        return `❌ Task \`${taskId}\` not found.

Use \`list_tasks\` to see available tasks.`;
    },
});

/**
 * Factory function to create all parallel agent tools
 */
export function createAsyncAgentTools(manager: ParallelAgentManager): Record<string, ToolDefinition> {
    return {
        spawn_agent: createSpawnAgentTool(manager),
        get_task_result: createGetTaskResultTool(manager),
        list_tasks: createListTasksTool(manager),
        cancel_task: createCancelTaskTool(manager),
    };
}
