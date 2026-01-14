/**
 * OpenCode Orchestrator Plugin
 *
 * 5-Agent Structured Architecture for OpenCode
 * 
 * Optimized for weak models (GLM-4.7, Gemma, Phi) through:
 * - XML-structured prompts with clear boundaries
 * - Explicit reasoning patterns (THINK → ACT → OBSERVE → ADJUST)
 * - Evidence-based completion requirements
 * - Parallel execution by default
 * 
 * Agents: Commander, Architect, Builder, Inspector, Memory
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
// Plugin Implementation
// ============================================================================

const OrchestratorPlugin = async (input: PluginInput) => {
    const { directory } = input;

    return {
        // Register tools
        tool: {
            call_agent: callAgentTool,
            slashcommand: createSlashcommandTool(),
            grep_search: grepSearchTool(directory),
            glob_search: globSearchTool(directory),
        },

        // Register commands and agents for OpenCode UI
        config: async (config: Record<string, unknown>) => {
            const existingCommands = (config.command as Record<string, unknown>) ?? {};
            const existingAgents = (config.agent as Record<string, unknown>) ?? {};

            // Register slash commands
            const orchestratorCommands: Record<string, unknown> = {};
            for (const [name, cmd] of Object.entries(COMMANDS)) {
                orchestratorCommands[name] = {
                    description: cmd.description,
                    template: cmd.template,
                    argumentHint: cmd.argumentHint,
                };
            }

            // Register Commander agent for OpenCode UI
            // This is the main entry point - other agents are internal
            const orchestratorAgents: Record<string, unknown> = {
                Commander: {
                    name: "Commander",
                    description: "5-agent orchestrator - runs until mission complete",
                    systemPrompt: AGENTS.commander.systemPrompt,
                },
            };

            config.command = {
                ...orchestratorCommands,
                ...existingCommands,
            };

            config.agent = {
                ...orchestratorAgents,
                ...existingAgents,
            };
        },

        // Handle incoming messages - auto-activate mission mode
        "chat.message": async (input: any, output: any) => {
            const parts = output.parts as Array<{ type: string; text?: string }>;
            const textPartIndex = parts.findIndex(p => p.type === "text" && p.text);
            if (textPartIndex === -1) return;

            const originalText = parts[textPartIndex].text || "";
            const parsed = detectSlashCommand(originalText);

            // Auto-activate mission mode when Commander agent is used
            // This makes Commander work like /task automatically - no command needed
            const agentName = input.agent?.toLowerCase() || "";
            if (agentName === "commander" && !state.missionActive) {
                const sessionID = input.sessionID;
                state.sessions.set(sessionID, {
                    enabled: true,
                    iterations: 0,
                    taskRetries: new Map(),
                    currentTask: "",
                });
                state.missionActive = true;

                // Inject the mission template for Commander
                // This ensures Commander always gets the full structured prompt
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

            // Handle explicit slash commands
            if (parsed) {
                const command = COMMANDS[parsed.command];
                if (command) {
                    parts[textPartIndex].text = command.template.replace(
                        /\$ARGUMENTS/g,
                        parsed.args || "continue from where we left off"
                    );

                    // Activate mission mode for /task
                    if (parsed.command === "task") {
                        const sessionID = input.sessionID;
                        state.sessions.set(sessionID, {
                            enabled: true,
                            iterations: 0,
                            taskRetries: new Map(),
                            currentTask: "",
                        });
                        state.missionActive = true;
                    }
                }
            }
        },

        // Track tool execution and update task graph
        "tool.execute.after": async (
            input: { tool: string; sessionID: string; callID: string; arguments?: any },
            output: { title: string; output: string; metadata: any }
        ) => {
            if (!state.missionActive) return;

            const session = state.sessions.get(input.sessionID);
            if (!session?.enabled) return;

            session.iterations++;

            // Track current task from call_agent arguments
            if (input.tool === "call_agent" && input.arguments?.task) {
                const taskIdMatch = input.arguments.task.match(/\[(TASK-\d+)\]/i);
                if (taskIdMatch) {
                    session.currentTask = taskIdMatch[1].toUpperCase();
                    session.graph?.updateTask(session.currentTask, { status: "running" });
                }
            }

            // Circuit breaker: max iterations
            if (session.iterations >= state.maxIterations) {
                state.missionActive = false;
                session.enabled = false;
                return;
            }

            // Parse Architect JSON output to create task graph
            if (output.output.includes("[") && output.output.includes("]") &&
                output.output.includes("{") && input.tool === "call_agent") {
                const jsonMatch = output.output.match(/```json\n([\s\S]*?)\n```/) ||
                    output.output.match(/\[\s+\{[\s\S]*?\}\s+\]/);
                if (jsonMatch) {
                    try {
                        const tasks = JSON.parse(jsonMatch[1] || jsonMatch[0]) as Task[];
                        if (Array.isArray(tasks) && tasks.length > 0) {
                            session.graph = new TaskGraph(tasks);
                            output.output += `\n\n━━━━━━━━━━━━\n✅ MISSION INITIALIZED\n${session.graph.getTaskSummary()}`;
                        }
                    } catch {
                        // Not valid JSON, ignore
                    }
                }
            }

            // Update task status based on agent output
            if (session.graph) {
                if (output.output.includes("✅ PASS") || output.output.includes("AUDIT RESULT: PASS")) {
                    const taskId = session.currentTask;
                    if (taskId) {
                        session.graph.updateTask(taskId, { status: "completed" });
                        session.taskRetries.clear();
                        output.output += `\n\n━━━━━━━━━━━━\n✅ TASK ${taskId} VERIFIED\n${session.graph.getTaskSummary()}`;
                    }
                } else if (output.output.includes("❌ FAIL") || output.output.includes("AUDIT RESULT: FAIL")) {
                    const taskId = session.currentTask;
                    if (taskId) {
                        const errorId = `error-${taskId}`;
                        const retries = (session.taskRetries.get(errorId) || 0) + 1;
                        session.taskRetries.set(errorId, retries);

                        if (retries >= state.maxRetries) {
                            session.graph.updateTask(taskId, { status: "failed" });
                            output.output += `\n\n━━━━━━━━━━━━\n⚠️ TASK ${taskId} FAILED (${retries}x)\nCall Architect for new strategy.`;
                        } else {
                            output.output += `\n\n━━━━━━━━━━━━\n🔄 RETRY ${retries}/${state.maxRetries} for ${taskId}`;
                        }
                    }
                }
            }

            // Append DAG status and ready tasks
            if (session.graph) {
                const readyTasks = session.graph.getReadyTasks();
                const guidance = readyTasks.length > 0
                    ? `\n👉 READY: ${readyTasks.map(t => `[${t.id}]`).join(", ")}`
                    : `\n⚠️ No ready tasks. Check dependencies.`;

                output.output += `\n\n━━━━━━━━━━━━\n${session.graph.getTaskSummary()}${guidance}`;
            }

            output.output += `\n\n[Step ${session.iterations}/${state.maxIterations}]`;
        },

        // Relentless Loop: Auto-continue until mission complete
        "assistant.done": async (input: any, output: any) => {
            if (!state.missionActive) return;

            const session = state.sessions.get(input.sessionID);
            if (!session?.enabled) return;

            const text = output.text || "";

            // Check for mission completion
            const isComplete =
                text.includes("✅ MISSION COMPLETE") ||
                text.includes("MISSION COMPLETE") ||
                (session.graph && session.graph.isCompleted?.());

            if (isComplete) {
                session.enabled = false;
                state.missionActive = false;
                state.sessions.delete(input.sessionID);
                return;
            }

            // Check iteration limit
            if (session.iterations >= state.maxIterations) {
                session.enabled = false;
                state.missionActive = false;
                return;
            }

            // Auto-continue: inject next action prompt
            output.continue = true;
            output.continueMessage = "continue";
        },
    };
};

export default OrchestratorPlugin;
