/**
 * OpenCode Orchestrator Plugin
 *
 * 5-Agent Structured Architecture
 * 
 * Optimized for weak models through:
 * - XML-structured prompts with clear boundaries
 * - Explicit reasoning patterns (THINK → ACT → OBSERVE → ADJUST)
 * - Evidence-based completion requirements
 * - Autonomous execution loop
 * 
 * Agents: Commander, Architect, Builder, Inspector, Recorder
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { AGENTS } from "./agents/definitions.js";
import { TaskGraph, type Task } from "./core/tasks.js";
import { state } from "./core/state.js";
import { callAgentTool } from "./tools/callAgent.js";
import { createSlashcommandTool, COMMANDS } from "./tools/slashCommand.js";
import { grepSearchTool, globSearchTool } from "./tools/search.js";
import { detectSlashCommand } from "./utils/common.js";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_STEPS = 500;
const TASK_COMMAND_MAX_STEPS = 1000;

const AGENT_EMOJI: Record<string, string> = {
    "architect": "🏗️",
    "builder": "🔨",
    "inspector": "🔍",
    "recorder": "💾",
    "commander": "🎯",
};

const CONTINUE_INSTRUCTION = `<auto_continue>
<status>Mission not complete. Keep executing.</status>

<rules>
1. DO NOT stop - mission is incomplete
2. DO NOT wait for user input
3. If previous action failed, try different approach
4. If agent returned nothing, proceed to next step
</rules>

<next_step>
What is the current state?
What is the next action?
Execute it NOW.
</next_step>
</auto_continue>`;

// ============================================================================
// Plugin
// ============================================================================

const OrchestratorPlugin = async (input: PluginInput) => {
    const { directory, client } = input;

    const sessions = new Map<string, {
        active: boolean;
        step: number;
        maxSteps: number;
        timestamp: number;
    }>();

    return {
        tool: {
            call_agent: callAgentTool,
            slashcommand: createSlashcommandTool(),
            grep_search: grepSearchTool(directory),
            glob_search: globSearchTool(directory),
        },

        config: async (config: Record<string, unknown>) => {
            const existingCommands = (config.command as Record<string, unknown>) ?? {};
            const existingAgents = (config.agent as Record<string, unknown>) ?? {};

            const orchestratorCommands: Record<string, unknown> = {};
            for (const [name, cmd] of Object.entries(COMMANDS)) {
                orchestratorCommands[name] = {
                    description: cmd.description,
                    template: cmd.template,
                    argumentHint: cmd.argumentHint,
                };
            }

            const orchestratorAgents: Record<string, unknown> = {
                Commander: {
                    name: "Commander",
                    description: "Autonomous orchestrator - executes until mission complete",
                    systemPrompt: AGENTS.commander.systemPrompt,
                },
            };

            config.command = { ...orchestratorCommands, ...existingCommands };
            config.agent = { ...orchestratorAgents, ...existingAgents };
        },

        "chat.message": async (msgInput: any, msgOutput: any) => {
            const parts = msgOutput.parts as Array<{ type: string; text?: string }>;
            const textPartIndex = parts.findIndex(p => p.type === "text" && p.text);
            if (textPartIndex === -1) return;

            const originalText = parts[textPartIndex].text || "";
            const parsed = detectSlashCommand(originalText);
            const sessionID = msgInput.sessionID;
            const agentName = (msgInput.agent || "").toLowerCase();

            // Commander agent: auto-activate with default steps
            if (agentName === "commander" && !sessions.has(sessionID)) {
                sessions.set(sessionID, {
                    active: true,
                    step: 0,
                    maxSteps: DEFAULT_MAX_STEPS,
                    timestamp: Date.now(),
                });
                state.missionActive = true;
                state.sessions.set(sessionID, {
                    enabled: true,
                    iterations: 0,
                    taskRetries: new Map(),
                    currentTask: "",
                });

                if (!parsed) {
                    const userMessage = originalText.trim();
                    if (userMessage) {
                        parts[textPartIndex].text = COMMANDS["task"].template.replace(
                            /\$ARGUMENTS/g,
                            userMessage
                        );
                    }
                }
            }

            // /task command: use extended steps for thorough execution
            if (parsed?.command === "task") {
                sessions.set(sessionID, {
                    active: true,
                    step: 0,
                    maxSteps: TASK_COMMAND_MAX_STEPS,
                    timestamp: Date.now(),
                });
                state.missionActive = true;
                state.sessions.set(sessionID, {
                    enabled: true,
                    iterations: 0,
                    taskRetries: new Map(),
                    currentTask: "",
                });

                parts[textPartIndex].text = COMMANDS["task"].template.replace(
                    /\$ARGUMENTS/g,
                    parsed.args || "continue previous work"
                );
            } else if (parsed) {
                const command = COMMANDS[parsed.command];
                if (command) {
                    parts[textPartIndex].text = command.template.replace(
                        /\$ARGUMENTS/g,
                        parsed.args || "continue"
                    );
                }
            }
        },

        "tool.execute.after": async (
            toolInput: { tool: string; sessionID: string; callID: string; arguments?: any },
            toolOutput: { title: string; output: string; metadata: any }
        ) => {
            const session = sessions.get(toolInput.sessionID);
            if (!session?.active) return;

            session.step++;
            session.timestamp = Date.now();

            const stateSession = state.sessions.get(toolInput.sessionID);

            if (toolInput.tool === "call_agent" && toolInput.arguments?.task && stateSession) {
                const taskIdMatch = toolInput.arguments.task.match(/\[(TASK-\d+)\]/i);
                if (taskIdMatch) {
                    stateSession.currentTask = taskIdMatch[1].toUpperCase();
                    stateSession.graph?.updateTask(stateSession.currentTask, { status: "running" });
                }

                // Show current agent with emoji
                const agentName = toolInput.arguments.agent as string;
                const emoji = AGENT_EMOJI[agentName] || "🤖";
                toolOutput.output = `${emoji} [${agentName.toUpperCase()}] Working...\n\n` + toolOutput.output;
            }

            if (session.step >= session.maxSteps) {
                session.active = false;
                state.missionActive = false;
                return;
            }

            // Parse task graph from Architect output
            if (toolOutput.output.includes("[") && toolOutput.output.includes("{") &&
                toolInput.tool === "call_agent" && stateSession) {
                const jsonMatch = toolOutput.output.match(/```json\n([\s\S]*?)\n```/) ||
                    toolOutput.output.match(/\[\s*\{[\s\S]*?\}\s*\]/);
                if (jsonMatch) {
                    try {
                        const tasks = JSON.parse(jsonMatch[1] || jsonMatch[0]) as Task[];
                        if (Array.isArray(tasks) && tasks.length > 0) {
                            stateSession.graph = new TaskGraph(tasks);
                            toolOutput.output += `\n\n━━━━━━━━━━━━\n✅ INITIALIZED\n${stateSession.graph.getTaskSummary()}`;
                        }
                    } catch { /* ignore */ }
                }
            }

            // Update task status
            if (stateSession?.graph) {
                const taskId = stateSession.currentTask;
                if (toolOutput.output.includes("✅ PASS") || toolOutput.output.includes("AUDIT RESULT: PASS")) {
                    if (taskId) {
                        stateSession.graph.updateTask(taskId, { status: "completed" });
                        stateSession.taskRetries.clear();
                        toolOutput.output += `\n\n━━━━━━━━━━━━\n✅ ${taskId} VERIFIED\n${stateSession.graph.getTaskSummary()}`;
                    }
                } else if (toolOutput.output.includes("❌ FAIL") || toolOutput.output.includes("AUDIT RESULT: FAIL")) {
                    if (taskId) {
                        const retries = (stateSession.taskRetries.get(taskId) || 0) + 1;
                        stateSession.taskRetries.set(taskId, retries);
                        if (retries >= state.maxRetries) {
                            stateSession.graph.updateTask(taskId, { status: "failed" });
                            toolOutput.output += `\n\n━━━━━━━━━━━━\n⚠️ ${taskId} FAILED (${retries}x)`;
                        } else {
                            toolOutput.output += `\n\n━━━━━━━━━━━━\n🔄 RETRY ${retries}/${state.maxRetries}`;
                        }
                    }
                }

                const readyTasks = stateSession.graph.getReadyTasks();
                if (readyTasks.length > 0) {
                    toolOutput.output += `\n👉 NEXT: ${readyTasks.map(t => `[${t.id}]`).join(", ")}`;
                }
            }

            toolOutput.output += `\n\n[${session.step}/${session.maxSteps}]`;
        },

        "assistant.done": async (assistantInput: any, assistantOutput: any) => {
            const sessionID = assistantInput.sessionID;
            const session = sessions.get(sessionID);

            if (!session?.active) return;

            const parts = assistantOutput.parts as Array<{ type: string; text?: string }> | undefined;
            const textContent = parts
                ?.filter((p: any) => p.type === "text" || p.type === "reasoning")
                .map((p: any) => p.text || "")
                .join("\n") || "";

            // Check completion
            if (textContent.includes("✅ MISSION COMPLETE") || textContent.includes("MISSION COMPLETE")) {
                session.active = false;
                state.missionActive = false;
                sessions.delete(sessionID);
                state.sessions.delete(sessionID);
                return;
            }

            // Check stop request
            if (textContent.includes("/stop") || textContent.includes("/cancel")) {
                session.active = false;
                state.missionActive = false;
                sessions.delete(sessionID);
                state.sessions.delete(sessionID);
                return;
            }

            session.step++;
            session.timestamp = Date.now();

            if (session.step >= session.maxSteps) {
                session.active = false;
                state.missionActive = false;
                return;
            }

            // Inject continuation
            try {
                if (client?.session?.prompt) {
                    await client.session.prompt({
                        path: { id: sessionID },
                        body: {
                            parts: [{
                                type: "text",
                                text: CONTINUE_INSTRUCTION + `\n\n[Step ${session.step}/${session.maxSteps}]`
                            }],
                        },
                    });
                }
            } catch {
                try {
                    await new Promise(r => setTimeout(r, 500));
                    if (client?.session?.prompt) {
                        await client.session.prompt({
                            path: { id: sessionID },
                            body: { parts: [{ type: "text", text: "continue" }] },
                        });
                    }
                } catch {
                    session.active = false;
                    state.missionActive = false;
                }
            }
        },

        handler: async ({ event }: { event: { type: string; properties?: unknown } }) => {
            if (event.type === "session.deleted") {
                const props = event.properties as { info?: { id?: string } } | undefined;
                if (props?.info?.id) {
                    sessions.delete(props.info.id);
                    state.sessions.delete(props.info.id);
                }
            }
        },
    };
};

export default OrchestratorPlugin;
