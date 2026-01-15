/**
 * Task Delegation Tools
 * 
 * Tools for delegating work to agents:
 * - delegate_task: Delegate work to an agent (sync or background)
 * - get_task_result: Retrieve completed task result
 * - list_tasks: View all parallel tasks
 * - cancel_task: Stop a running task
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import { ParallelAgentManager, type ParallelTask } from "../core/async-agent.js";

// Re-export for backward compatibility
export { ParallelAgentManager as AsyncAgentManager } from "../core/async-agent.js";

type OpencodeClient = Parameters<typeof tool>[0] extends { execute: infer E }
    ? E extends (args: unknown, context: infer C) => unknown
    ? C extends { client?: infer CL }
    ? CL
    : never
    : never
    : never;

/**
 * delegate_task - Delegate work to an agent (sync or background)
 */
export const createDelegateTaskTool = (manager: ParallelAgentManager, client: unknown) => tool({
    description: `Delegate a task to an agent.

<mode>
- background=true: Non-blocking. Task runs in parallel session. Use get_task_result later.
- background=false: Blocking. Waits for result. Use when you need output immediately.
</mode>

<when_to_use_background_true>
- Multiple independent tasks to run in parallel
- Long-running tasks (build, test, analysis)
- You have other work to do while waiting
- Example: "Build module A" + "Test module B" in parallel
</when_to_use_background_true>

<when_to_use_background_false>
- You need the result for the very next step
- Single task with nothing else to do
- Quick questions that return fast
</when_to_use_background_false>

<safety>
- Max 3 background tasks per agent type (extras queue automatically)
- Auto-timeout: 30 minutes
- Auto-cleanup: 5 minutes after completion
</safety>`,
    args: {
        agent: tool.schema.string().describe("Agent name (e.g., 'builder', 'inspector', 'architect')"),
        description: tool.schema.string().describe("Short task description"),
        prompt: tool.schema.string().describe("Full prompt/instructions for the agent"),
        background: tool.schema.boolean().describe("true=async (returns task_id), false=sync (waits for result). REQUIRED."),
    },
    async execute(args, context) {
        const { agent, description, prompt, background } = args;
        const ctx = context as { sessionID: string };
        const sessionClient = client as {
            session: {
                create: (opts: { body: { parentID: string; title: string }; query: { directory: string } }) => Promise<{ data?: { id: string }; error?: string }>;
                prompt: (opts: { path: { id: string }; body: { agent: string; parts: { type: string; text: string }[] } }) => Promise<{ error?: string }>;
                messages: (opts: { path: { id: string } }) => Promise<{ data?: unknown[]; error?: string }>;
                status: () => Promise<{ data?: Record<string, { type: string }> }>;
            }
        };

        if (background === undefined) {
            return `❌ 'background' parameter is REQUIRED.
- background=true: Run in parallel, returns task ID
- background=false: Wait for result (blocking)`;
        }

        // BACKGROUND MODE: Use ParallelAgentManager
        if (background === true) {
            try {
                const task = await manager.launch({
                    agent,
                    description,
                    prompt,
                    parentSessionID: ctx.sessionID,
                });

                const runningCount = manager.getRunningTasks().length;
                const pendingCount = manager.getPendingCount(ctx.sessionID);

                console.log(`[parallel] 🚀 SPAWNED ${task.id} → ${agent}: ${description}`);

                return `
## 🚀 BACKGROUND TASK SPAWNED

**Task Details**
- **ID**: \`${task.id}\`
- **Agent**: ${agent}
- **Description**: ${description}
- **Status**: ⏳ Running in background (non-blocking)

**Active Tasks**
- Running: ${runningCount}
- Pending: ${pendingCount}

---

**Monitoring Commands**

Check progress anytime:
- \`list_tasks()\` - View all parallel tasks
- \`get_task_result({ taskId: "${task.id}" })\` - Get latest result
- \`cancel_task({ taskId: "${task.id}" })\` - Stop this task

---

✓ System will notify when ALL tasks complete. You can continue working!`;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.log(`[parallel] ❌ FAILED: ${message}`);
                return `❌ Failed to spawn background task: ${message}`;
            }
        }

        // SYNC MODE: Create session, prompt, wait for result
        console.log(`[delegate] ⏳ SYNC ${agent}: ${description}`);

        try {
            const session = sessionClient.session;

            // Get parent directory
            const directory = "."; // Default

            // Create child session
            const createResult = await session.create({
                body: {
                    parentID: ctx.sessionID,
                    title: `Task: ${description}`,
                },
                query: { directory },
            });

            if (createResult.error || !createResult.data?.id) {
                return `❌ Failed to create session: ${createResult.error || "No session ID"}`;
            }

            const sessionID = createResult.data.id;
            const startTime = Date.now();

            // Send prompt
            try {
                await session.prompt({
                    path: { id: sessionID },
                    body: {
                        agent,
                        parts: [{ type: "text", text: prompt }],
                    },
                });
            } catch (promptError) {
                const errorMessage = promptError instanceof Error ? promptError.message : String(promptError);
                return `❌ Failed to send prompt: ${errorMessage}\n\nSession ID: ${sessionID}`;
            }

            // Poll for completion
            const POLL_INTERVAL_MS = 500;
            const MAX_POLL_TIME_MS = 10 * 60 * 1000; // 10 minutes
            const MIN_STABILITY_MS = 5000;
            const STABILITY_POLLS_REQUIRED = 3;
            let stablePolls = 0;
            let lastMsgCount = 0;

            while (Date.now() - startTime < MAX_POLL_TIME_MS) {
                await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

                const statusResult = await session.status();
                const allStatuses = statusResult.data ?? {};
                const sessionStatus = allStatuses[sessionID];

                if (sessionStatus?.type !== "idle") {
                    stablePolls = 0;
                    lastMsgCount = 0;
                    continue;
                }

                if (Date.now() - startTime < MIN_STABILITY_MS) continue;

                const messagesResult = await session.messages({ path: { id: sessionID } });
                const messages = (messagesResult.data ?? []) as unknown[];
                const currentMsgCount = messages.length;

                if (currentMsgCount === lastMsgCount) {
                    stablePolls++;
                    if (stablePolls >= STABILITY_POLLS_REQUIRED) break;
                } else {
                    stablePolls = 0;
                    lastMsgCount = currentMsgCount;
                }
            }

            // Get result
            const messagesResult = await session.messages({ path: { id: sessionID } });
            const messages = (messagesResult.data ?? []) as Array<{
                info?: { role?: string };
                parts?: Array<{ type?: string; text?: string }>;
            }>;

            const assistantMsgs = messages
                .filter(m => m.info?.role === "assistant")
                .reverse();

            const lastMsg = assistantMsgs[0];
            if (!lastMsg) {
                return `❌ No assistant response found.\n\nSession ID: ${sessionID}`;
            }

            const textParts = lastMsg.parts?.filter(p =>
                p.type === "text" || p.type === "reasoning"
            ) ?? [];
            const textContent = textParts.map(p => p.text ?? "").filter(Boolean).join("\n");

            const duration = Math.floor((Date.now() - startTime) / 1000);
            console.log(`[delegate] ✅ COMPLETED ${agent}: ${description} (${duration}s)`);

            return `✅ **Task Completed** (${duration}s)

Agent: ${agent}
Session ID: ${sessionID}

---

${textContent || "(No text output)"}`;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.log(`[delegate] ❌ FAILED: ${message}`);
            return `❌ Task failed: ${message}`;
        }
    },
});

/**
 * get_task_result - Get result from a completed background task
 */
export const createGetTaskResultTool = (manager: ParallelAgentManager) => tool({
    description: `Get the result from a completed background task.

<note>
If the task is still running, returns status info.
Wait for the "All Complete" notification before checking.
</note>`,
    args: {
        taskId: tool.schema.string().describe("Task ID from delegate_task (e.g., 'task_a1b2c3d4')"),
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
 * list_tasks - List all background tasks
 */
export const createListTasksTool = (manager: ParallelAgentManager) => tool({
    description: `List all background tasks and their status.`,
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
            return `📋 No background tasks found${status !== "all" ? ` (filter: ${status})` : ""}.

Use \`delegate_task({ ..., background: true })\` to spawn background tasks.`;
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

        return `📋 **Background Tasks** (${tasks.length} shown)
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
 * cancel_task - Cancel a running background task
 */
export const createCancelTaskTool = (manager: ParallelAgentManager) => tool({
    description: `Cancel a running background task.

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
 * Factory function to create all task delegation tools
 */
export function createAsyncAgentTools(manager: ParallelAgentManager, client?: unknown): Record<string, ToolDefinition> {
    return {
        delegate_task: createDelegateTaskTool(manager, client),
        get_task_result: createGetTaskResultTool(manager),
        list_tasks: createListTasksTool(manager),
        cancel_task: createCancelTaskTool(manager),
    };
}
