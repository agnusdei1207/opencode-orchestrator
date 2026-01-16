/**
 * delegate_task Tool
 * 
 * Delegate work to an agent (sync or background mode)
 */

import { tool } from "@opencode-ai/plugin";
import { ParallelAgentManager } from "../../core/agents/index.js";

export const createDelegateTaskTool = (manager: ParallelAgentManager, client: unknown) => tool({
    description: `Delegate a task to an agent.

<mode>
- background=true: Non-blocking. Returns task ID immediately.
- background=false: Blocking. Waits for result.
</mode>

<safety>
- Max 3 tasks per agent type
- Auto-timeout: 30 minutes
</safety>`,
    args: {
        agent: tool.schema.string().describe("Agent name"),
        description: tool.schema.string().describe("Task description"),
        prompt: tool.schema.string().describe("Prompt for the agent"),
        background: tool.schema.boolean().describe("true=async, false=sync"),
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
            return `❌ 'background' parameter is REQUIRED.`;
        }

        if (background === true) {
            try {
                const task = await manager.launch({
                    agent, description, prompt,
                    parentSessionID: ctx.sessionID,
                });
                return `🚀 Task spawned: \`${task.id}\` (${agent})`;
            } catch (error) {
                return `❌ Failed: ${error instanceof Error ? error.message : String(error)}`;
            }
        }

        // SYNC MODE
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
                body: { agent, parts: [{ type: "text", text: prompt }] },
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
            const text = lastMsg?.parts?.filter(p => p.type === "text" || p.type === "reasoning").map(p => p.text ?? "").join("\n") || "";

            return `✅ Completed (${Math.floor((Date.now() - startTime) / 1000)}s)\n\n${text || "(No output)"}`;
        } catch (error) {
            return `❌ Failed: ${error instanceof Error ? error.message : String(error)}`;
        }
    },
});
