/**
 * delegate_task Tool
 * 
 * Delegate work to an agent (sync or background mode)
 * Supports resuming existing sessions for context preservation
 */

import { tool } from "@opencode-ai/plugin";
import { ParallelAgentManager } from "../../core/agents/index.js";
import { PARALLEL_TASK, PART_TYPES } from "../../shared/constants.js";
import { log } from "../../core/agents/logger.js";

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

                // SYNC MODE for resume - wait for completion
                const startTime = Date.now();
                const session = sessionClient.session;

                let stablePolls = 0, lastMsgCount = 0;
                while (Date.now() - startTime < PARALLEL_TASK.SYNC_TIMEOUT_MS) {
                    await new Promise(r => setTimeout(r, 500));
                    const statusResult = await session.status();
                    if (statusResult.data?.[task.sessionID]?.type !== "idle") { stablePolls = 0; continue; }
                    if (Date.now() - startTime < 5000) continue;

                    const msgs = await session.messages({ path: { id: task.sessionID } });
                    const count = (msgs.data ?? []).length;
                    if (count === lastMsgCount) { stablePolls++; if (stablePolls >= 3) break; }
                    else { stablePolls = 0; lastMsgCount = count; }
                }

                const msgs = await session.messages({ path: { id: task.sessionID } });
                const messages = (msgs.data ?? []) as Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }>;
                const lastMsg = messages.filter(m => m.info?.role === "assistant").reverse()[0];
                const text = lastMsg?.parts?.filter(p => p.type === PART_TYPES.TEXT || p.type === PART_TYPES.REASONING).map(p => p.text ?? "").join("\n") || "";

                return `🔄 Resumed & Completed (${Math.floor((Date.now() - startTime) / 1000)}s)\n\n${text || "(No output)"}`;
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
                return `❌ Failed to create session`;
            }

            const sessionID = createResult.data.id;
            const startTime = Date.now();

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

            // Poll for completion
            let stablePolls = 0, lastMsgCount = 0;
            while (Date.now() - startTime < 10 * 60 * 1000) {
                await new Promise(r => setTimeout(r, 500));
                const statusResult = await session.status();
                if (statusResult.data?.[sessionID]?.type !== "idle") { stablePolls = 0; continue; }
                if (Date.now() - startTime < 5000) continue;

                const msgs = await session.messages({ path: { id: sessionID } });
                const count = (msgs.data ?? []).length;
                if (count === lastMsgCount) { stablePolls++; if (stablePolls >= 3) break; }
                else { stablePolls = 0; lastMsgCount = count; }
            }

            const msgs = await session.messages({ path: { id: sessionID } });
            const messages = (msgs.data ?? []) as Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }>;
            const lastMsg = messages.filter(m => m.info?.role === "assistant").reverse()[0];
            const text = lastMsg?.parts?.filter(p => p.type === PART_TYPES.TEXT || p.type === PART_TYPES.REASONING).map(p => p.text ?? "").join("\n") || "";

            return `✅ Completed (${Math.floor((Date.now() - startTime) / 1000)}s)\n` +
                `Session: \`${sessionID}\` (save for resume)\n\n${text || "(No output)"}`;
        } catch (error) {
            return `❌ Failed: ${error instanceof Error ? error.message : String(error)}`;
        }
    },
});

