import { tool } from "@opencode-ai/plugin";
import { callRustTool } from "./rust.js";

export const runBackgroundTool = tool({
    description: `Run a shell command in background and get a task ID.

<purpose>
Execute long-running commands (builds, tests, etc.) without blocking.
The command runs asynchronously - use check_background to get results.
</purpose>

<examples>
- "npm run build" → Build project in background
- "cargo test" → Run Rust tests
- "sleep 10 && echo done" → Delayed execution
</examples>

<flow>
1. Call run_background with command
2. Get task ID immediately (e.g., job_a1b2c3d4)
3. Continue other work
4. Call check_background with task ID to get results
</flow>`,
    args: {
        command: tool.schema.string().describe("Shell command to execute"),
        cwd: tool.schema.string().optional().describe("Working directory (default: project root)"),
        timeout: tool.schema.number().optional().describe("Timeout in milliseconds (default: 300000 = 5 min)"),
        label: tool.schema.string().optional().describe("Human-readable label for this task"),
    },
    async execute(args) {
        return callRustTool("run_background", args);
    },
});

export const checkBackgroundTool = tool({
    description: `Check the status and output of a background task.

<purpose>
Retrieve the current status and output of a previously started background task.
Use this after run_background to get results.
</purpose>

<output_includes>
- Status: running/done/error/timeout
- Exit code (if completed)
- Duration
- Full output (stdout + stderr)
</output_includes>`,
    args: {
        task_id: tool.schema.string().describe("Task ID from run_background (e.g., job_a1b2c3d4)"),
        tail_lines: tool.schema.number().optional().describe("Limit output to last N lines (default: show all)"),
    },
    async execute(args) {
        return callRustTool("check_background", args);
    },
});

export const listBackgroundTool = tool({
    description: `List all background tasks and their current status.

<purpose>
Get an overview of all running and completed background tasks.
Useful to check what's in progress before starting new tasks.
</purpose>`,
    args: {
        status: tool.schema.enum(["all", "running", "done", "error"]).optional()
            .describe("Filter by status (default: all)"),
    },
    async execute(args) {
        return callRustTool("list_background", args);
    },
});

export const killBackgroundTool = tool({
    description: `Kill a running background task.

<purpose>
Stop a background task that is taking too long or no longer needed.
</purpose>`,
    args: {
        task_id: tool.schema.string().describe("Task ID to kill (e.g., job_a1b2c3d4)"),
    },
    async execute(args) {
        return callRustTool("kill_background", args);
    },
});
