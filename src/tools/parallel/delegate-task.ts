/**
 * delegate_task Tool
 * 
 * Delegate work to an agent (sync or background mode)
 * Supports resuming existing sessions for context preservation
 * 
 * Safety features:
 * - Maximum poll count to prevent infinite loops
 * - Timeout guarantee with graceful degradation
 * - Resource cleanup on all exit paths
 */

import { tool } from "@opencode-ai/plugin";
import { ParallelAgentManager } from "../../core/agents/index.js";
import { PARALLEL_TASK, PART_TYPES, MESSAGE_ROLES, SESSION_STATUS } from "../../shared/index.js";
import { log } from "../../core/agents/logger.js";
import { presets } from "../../core/notification/presets.js";

// ============================================================
// Safety Constants (from shared constants for consistency)
// ============================================================
const MIN_IDLE_TIME_MS = PARALLEL_TASK.MIN_IDLE_TIME_MS;
const POLL_INTERVAL_MS = PARALLEL_TASK.POLL_INTERVAL_MS;
const SYNC_TIMEOUT_MS = PARALLEL_TASK.SYNC_TIMEOUT_MS;
const MAX_POLL_COUNT = PARALLEL_TASK.MAX_POLL_COUNT;
const STABLE_POLLS_REQUIRED = PARALLEL_TASK.STABLE_POLLS_REQUIRED;

// Session client type definition
type SessionClient = {
    create: (opts: { body: { parentID: string; title: string }; query: { directory: string } }) => Promise<{ data?: { id: string }; error?: string }>;
    prompt: (opts: { path: { id: string }; body: { agent: string; tools?: Record<string, boolean>; parts: { type: string; text: string }[] } }) => Promise<{ error?: string }>;
    messages: (opts: { path: { id: string } }) => Promise<{ data?: unknown[]; error?: string }>;
    status: () => Promise<{ data?: Record<string, { type: string }> }>;
};

/**
 * Validate that a session has actual output before marking complete.
 * Prevents premature completion when session.idle fires before agent responds.
 */
async function validateSessionHasOutput(
    session: Pick<SessionClient, 'messages'>,
    sessionID: string
): Promise<boolean> {
    try {
        const response = await session.messages({ path: { id: sessionID } });
        const messages = (response.data ?? []) as Array<{
            info?: { role?: string };
            parts?: Array<{ type?: string; text?: string; tool?: string }>;
        }>;

        const hasAssistantMessage = messages.some(
            (m) => m.info?.role === MESSAGE_ROLES.ASSISTANT
        );

        if (!hasAssistantMessage) {
            return false;
        }

        // Check that at least one message has content
        const hasContent = messages.some((m) => {
            if (m.info?.role !== MESSAGE_ROLES.ASSISTANT) return false;
            const parts = m.parts ?? [];
            return parts.some((p) =>
                // Text content
                (p.type === PART_TYPES.TEXT && p.text && p.text.trim().length > 0) ||
                // Reasoning content
                (p.type === PART_TYPES.REASONING && p.text && p.text.trim().length > 0) ||
                // Tool calls (indicates work was done)
                p.type === PART_TYPES.TOOL || p.type === PART_TYPES.TOOL_USE || p.tool
            );
        });

        return hasContent;
    } catch (error) {
        log("[delegate-task] Error validating session output:", error);
        // On error, allow completion to proceed (fail-open)
        return true;
    }
}

/**
 * Poll result type for clarity
 */
type PollResult = {
    success: boolean;
    timedOut: boolean;
    error?: string;
    pollCount: number;
    elapsedMs: number;
};

/**
 * Safe polling with hard limits to prevent infinite loops.
 * Returns structured result with diagnostics.
 */
async function pollWithSafetyLimits(
    session: SessionClient,
    sessionID: string,
    startTime: number
): Promise<PollResult> {
    let pollCount = 0;
    let stablePolls = 0;
    let lastMsgCount = 0;
    let hasValidOutput = false;
    let lastLogTime = 0;

    while (pollCount < MAX_POLL_COUNT) {
        pollCount++;
        const elapsed = Date.now() - startTime;

        // Hard timeout check (belt and suspenders)
        if (elapsed >= SYNC_TIMEOUT_MS) {
            log("[delegate-task] Hard timeout reached", { pollCount, elapsed });
            return { success: false, timedOut: true, pollCount, elapsedMs: elapsed };
        }

        // Rate-limited logging (every 10 seconds)
        if (Date.now() - lastLogTime > 10000) {
            log("[delegate-task] Polling...", {
                pollCount,
                elapsed: Math.floor(elapsed / 1000) + "s",
                stablePolls,
                hasValidOutput
            });
            lastLogTime = Date.now();
        }

        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

        try {
            const statusResult = await session.status();
            const sessionStatus = statusResult.data?.[sessionID];

            // Session not in status yet - continue waiting
            if (!sessionStatus) {
                stablePolls = 0;
                continue;
            }

            // Session is not idle - reset stability counter
            if (sessionStatus.type !== SESSION_STATUS.IDLE) {
                stablePolls = 0;
                continue;
            }

            // Minimum time not elapsed
            if (elapsed < MIN_IDLE_TIME_MS) {
                continue;
            }

            // Validate session has actual output (only check once)
            if (!hasValidOutput) {
                hasValidOutput = await validateSessionHasOutput(session, sessionID);
                if (!hasValidOutput) {
                    continue;
                }
                log("[delegate-task] Valid output detected", { pollCount, elapsed });
            }

            // Stability detection
            const msgs = await session.messages({ path: { id: sessionID } });
            const count = (msgs.data ?? []).length;

            if (count === lastMsgCount) {
                stablePolls++;
                if (stablePolls >= STABLE_POLLS_REQUIRED) {
                    log("[delegate-task] Stable completion", { pollCount, stablePolls, elapsed });
                    return { success: true, timedOut: false, pollCount, elapsedMs: elapsed };
                }
            } else {
                stablePolls = 0;
                lastMsgCount = count;
            }
        } catch (error) {
            log("[delegate-task] Poll error (continuing):", error);
            // Continue polling on transient errors
        }
    }

    // Max poll count reached (should not happen if timeout works)
    log("[delegate-task] Max poll count reached", { pollCount, elapsed: Date.now() - startTime });
    return {
        success: false,
        timedOut: true,
        error: "Max poll count exceeded",
        pollCount,
        elapsedMs: Date.now() - startTime
    };
}

/**
 * Extract final result from session messages
 */
async function extractSessionResult(
    session: Pick<SessionClient, 'messages'>,
    sessionID: string
): Promise<string> {
    try {
        const msgs = await session.messages({ path: { id: sessionID } });
        const messages = (msgs.data ?? []) as Array<{
            info?: { role?: string };
            parts?: Array<{ type?: string; text?: string }>
        }>;
        const lastMsg = messages.filter(m => m.info?.role === MESSAGE_ROLES.ASSISTANT).reverse()[0];
        const text = lastMsg?.parts
            ?.filter(p => p.type === PART_TYPES.TEXT || p.type === PART_TYPES.REASONING)
            .map(p => p.text ?? "")
            .join("\n") || "";
        return text;
    } catch (error) {
        log("[delegate-task] Error extracting result:", error);
        return "(Error extracting result)";
    }
}

export const createDelegateTaskTool = (manager: ParallelAgentManager, client: unknown) => tool({
    description: `Delegate a task to an agent.

<mode>
- background=true: Non-blocking. Returns task ID immediately.
- background=false: Blocking. Waits for result.
</mode>

<resume>
- resume: Optional session ID to continue existing session.
- When set, continues previous work instead of starting fresh.
- Preserves all context from previous conversation.
- Use for: retry after failure, follow-up questions, token efficiency.
</resume>

<safety>
- Max 10 tasks per agent type (configurable)
- Auto-timeout: 60 minutes
</safety>`,
    args: {
        agent: tool.schema.string().describe("Agent name"),
        description: tool.schema.string().describe("Task description"),
        prompt: tool.schema.string().describe("Prompt for the agent"),
        background: tool.schema.boolean().describe("true=async, false=sync"),
        resume: tool.schema.string().optional().describe("Session ID to resume (from previous task.sessionID)"),
    },
    async execute(args, context) {
        const { agent, description, prompt, background, resume } = args;
        const ctx = context as { sessionID: string };

        log("[delegate-task.ts] execute() called", { agent, description, background, resume, parentSession: ctx.sessionID });

        const sessionClient = client as {
            session: {
                create: (opts: { body: { parentID: string; title: string }; query: { directory: string } }) => Promise<{ data?: { id: string }; error?: string }>;
                prompt: (opts: { path: { id: string }; body: { agent: string; tools?: Record<string, boolean>; parts: { type: string; text: string }[] } }) => Promise<{ error?: string }>;
                messages: (opts: { path: { id: string } }) => Promise<{ data?: unknown[]; error?: string }>;
                status: () => Promise<{ data?: Record<string, { type: string }> }>;
            }
        };

        if (background === undefined) {
            return `❌ 'background' parameter is REQUIRED.`;
        }

        // =========================================
        // RESUME MODE: Continue existing session
        // =========================================
        if (resume) {
            try {
                const task = await manager.resume({
                    sessionId: resume,
                    prompt,
                    parentSessionID: ctx.sessionID,
                });

                if (background === true) {
                    return `🔄 Resumed task: \`${task.id}\` (${task.agent}) in session \`${task.sessionID}\`\n\n` +
                        `Previous context preserved. Use \`get_task_result({ taskId: "${task.id}" })\` when complete.`;
                }

                // SYNC MODE for resume - use safe polling
                const startTime = Date.now();
                const session = sessionClient.session;

                log("[delegate-task] Resume: starting sync wait", { taskId: task.id, sessionID: task.sessionID });
                const pollResult = await pollWithSafetyLimits(session, task.sessionID, startTime);

                if (pollResult.timedOut) {
                    return `⚠️ Resume timeout after ${Math.floor(pollResult.elapsedMs / 1000)}s (${pollResult.pollCount} polls)\n` +
                        `Session: \`${task.sessionID}\` - Use get_task_result or resume later.`;
                }

                const text = await extractSessionResult(session, task.sessionID);
                return `🔄 Resumed & Completed (${Math.floor(pollResult.elapsedMs / 1000)}s)\n\n${text || "(No output)"}`;
            } catch (error) {
                return `❌ Resume failed: ${error instanceof Error ? error.message : String(error)}`;
            }
        }

        // =========================================
        // BACKGROUND MODE: Launch new async task
        // =========================================
        if (background === true) {
            try {
                const task = await manager.launch({
                    agent, description, prompt,
                    parentSessionID: ctx.sessionID,
                });
                presets.taskStarted(task.id, agent);
                return `🚀 Task spawned: \`${task.id}\` (${agent})\n` +
                    `Session: \`${task.sessionID}\` (save for resume)`;
            } catch (error) {
                return `❌ Failed: ${error instanceof Error ? error.message : String(error)}`;
            }
        }

        // =========================================
        // SYNC MODE: Create new session and wait
        // =========================================
        try {
            const session = sessionClient.session;
            const createResult = await session.create({
                body: { parentID: ctx.sessionID, title: `Task: ${description}` },
                query: { directory: "." },
            });

            if (createResult.error || !createResult.data?.id) {
                return `❌ Failed to create session: ${createResult.error || "No session ID returned"}`;
            }

            const sessionID = createResult.data.id;
            const startTime = Date.now();

            log("[delegate-task] Sync: starting", { agent, sessionID });

            // Fire the prompt (don't await - it returns immediately)
            await session.prompt({
                path: { id: sessionID },
                body: {
                    agent,
                    tools: {
                        delegate_task: false,
                        get_task_result: false,
                        list_tasks: false,
                        cancel_task: false,
                    },
                    parts: [{ type: PART_TYPES.TEXT, text: prompt }]
                },
            });

            // Poll for completion with safety limits
            const pollResult = await pollWithSafetyLimits(session, sessionID, startTime);

            if (pollResult.timedOut) {
                log("[delegate-task] Sync: timed out", pollResult);
                return `⚠️ Timeout after ${Math.floor(pollResult.elapsedMs / 1000)}s (${pollResult.pollCount} polls)\n` +
                    `Session: \`${sessionID}\` - Use get_task_result or resume later.`;
            }

            const text = await extractSessionResult(session, sessionID);
            log("[delegate-task] Sync: completed", { sessionID, elapsedMs: pollResult.elapsedMs });

            return `✅ Completed (${Math.floor(pollResult.elapsedMs / 1000)}s)\n` +
                `Session: \`${sessionID}\` (save for resume)\n\n${text || "(No output)"}`;
        } catch (error) {
            log("[delegate-task] Sync: error", error);
            return `❌ Failed: ${error instanceof Error ? error.message : String(error)}`;
        }
    },
});
