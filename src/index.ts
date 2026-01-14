/**
 * OpenCode Orchestrator Plugin
 *
 * 6-Agent Collaborative Architecture for OpenCode
 * 
 * Philosophy: Cheap models (GLM-4.7, Gemma, Phi) can outperform
 * expensive models through intelligent task decomposition and
 * team collaboration with quality gates.
 */

import { tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import { AGENTS } from "./agents/definitions.js";
import { TaskGraph, type Task } from "./core/tasks.js";
import { state } from "./core/state.js";
import { callAgentTool } from "./tools/callAgent.js";
import { createSlashcommandTool, COMMANDS } from "./tools/slashCommand.js";
import { grepSearchTool, globSearchTool } from "./tools/search.js";
import { detectSlashCommand } from "./utils/common.js";

// ============================================================================
// 6-Agent Collaborative Architecture
// ============================================================================

interface AgentDefinition {
    id: string;
    description: string;
    systemPrompt: string;
    canWrite: boolean;
    canBash: boolean;
}


// ============================================================================
// Binary Management
// ============================================================================

// ============================================================================
// State Management
// ============================================================================


// ============================================================================
// call_agent Tool
// ============================================================================

// ============================================================================
// Slash Commands
// ============================================================================

// ============================================================================
// Slash Command Tool
// ============================================================================

// ============================================================================
// Search Tools
// ============================================================================

// ============================================================================
// Utilities
// ============================================================================

// ============================================================================
// Plugin
// ============================================================================

const OrchestratorPlugin = async (input: PluginInput) => {
    const { directory } = input;

    return {
        tool: {
            call_agent: callAgentTool,
            slashcommand: createSlashcommandTool(),
            grep_search: grepSearchTool(directory),
            glob_search: globSearchTool(directory),
        },

        // Register commands and agents so they appear in OpenCode's UI
        config: async (config: Record<string, unknown>) => {
            const existingCommands = (config.command as Record<string, unknown>) ?? {};
            const existingAgents = (config.agent as Record<string, unknown>) ?? {};

            // Convert COMMANDS to OpenCode command format
            const orchestratorCommands: Record<string, unknown> = {};
            for (const [name, cmd] of Object.entries(COMMANDS)) {
                orchestratorCommands[name] = {
                    description: cmd.description,
                    template: cmd.template,
                    argumentHint: cmd.argumentHint,
                };
            }

            // Register agents for OpenCode UI display
            // Only expose Orchestrator - other agents are internal
            // Note: Key must match exactly what OpenCode looks up (case-sensitive)
            const orchestratorAgents: Record<string, unknown> = {
                Orchestrator: {
                    name: "Orchestrator",
                    description: "Mission Commander - 6-agent collaborative AI for complex tasks",
                    systemPrompt: AGENTS.orchestrator.systemPrompt,
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

        "chat.message": async (input: any, output: any) => {
            const parts = output.parts as Array<{ type: string; text?: string }>;
            const textPartIndex = parts.findIndex(p => p.type === "text" && p.text);
            if (textPartIndex === -1) return;

            const originalText = parts[textPartIndex].text || "";
            const parsed = detectSlashCommand(originalText);

            // Auto-activate mission mode when Orchestrator agent is used
            // This makes Orchestrator work like /task automatically
            const agentName = input.agent?.toLowerCase() || "";
            if (agentName === "orchestrator" && !state.missionActive) {
                const sessionID = input.sessionID;
                state.sessions.set(sessionID, {
                    enabled: true,
                    iterations: 0,
                    taskRetries: new Map(),
                    currentTask: "",
                });
                state.missionActive = true;
            }

            if (parsed) {
                const command = COMMANDS[parsed.command];
                if (command) {
                    parts[textPartIndex].text = command.template.replace(/\$ARGUMENTS/g, parsed.args || "continue");

                    if (parsed.command === "task" || parsed.command === "flow" || parsed.command === "dag" || parsed.command === "auto" || parsed.command === "ignite") {
                        const sessionID = input.sessionID;
                        state.sessions.set(sessionID, {
                            enabled: true,
                            iterations: 0,
                            taskRetries: new Map(),
                            currentTask: "",
                        });
                        state.missionActive = true;
                    } else if (parsed.command === "stop" || parsed.command === "cancel") {
                        state.sessions.delete(input.sessionID);
                        state.missionActive = false;
                    }
                }
            }
        },

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

            if (output.output.includes("[") && output.output.includes("]") && output.output.includes("{") && input.tool === "call_agent") {
                // Try to detect and parse Planner JSON output
                const jsonMatch = output.output.match(/```json\n([\s\S]*?)\n```/) || output.output.match(/\[\s+\{[\s\S]*?\}\s+\]/);
                if (jsonMatch) {
                    try {
                        const tasks = JSON.parse(jsonMatch[1] || jsonMatch[0]) as Task[];
                        if (Array.isArray(tasks) && tasks.length > 0) {
                            session.graph = new TaskGraph(tasks);
                            output.output += `\n\n━━━━━━━━━━━━\n✅ MISSION INITIALIZED\n${session.graph.getTaskSummary()}`;
                        }
                    } catch (e) {
                        // Not valid JSON or not planner output, ignore
                    }
                }
            }

            // Sync TaskGraph status based on agent output
            if (session.graph) {
                if (output.output.includes("✅ PASS")) {
                    const taskId = session.currentTask;
                    if (taskId) {
                        session.graph.updateTask(taskId, { status: "completed" });
                        session.taskRetries.clear();
                        output.output += `\n\n━━━━━━━━━━━━\n✅ TASK ${taskId} VERIFIED\n${session.graph.getTaskSummary()}`;
                    }
                } else if (output.output.includes("❌ FAIL")) {
                    const taskId = session.currentTask;
                    if (taskId) {
                        const errorId = `error-${taskId}`;
                        const retries = (session.taskRetries.get(errorId) || 0) + 1;
                        session.taskRetries.set(errorId, retries);
                        if (retries >= state.maxRetries) {
                            session.graph.updateTask(taskId, { status: "failed" });
                            output.output += `\n\n━━━━━━━━━━━━\n⚠️ TASK ${taskId} FAILED (Retry Limit)\nPIVOT REQUIRED: Re-plan or seek context.`;
                        } else {
                            output.output += `\n\n━━━━━━━━━━━━\n🔄 RETRY ${retries}/${state.maxRetries} for ${taskId}`;
                        }
                    }
                }
            } else {
                // Legacy fallback for non-DAG mode
                const errorMatch = output.output.match(/\[ERROR-(\d+)\]/);
                if (errorMatch) {
                    const errorId = `error-${session.currentTask || 'unknown'}`;
                    const retries = (session.taskRetries.get(errorId) || 0) + 1;
                    session.taskRetries.set(errorId, retries);

                    if (retries >= state.maxRetries) {
                        output.output += `\n\n━━━━━━━━━━━━\n⚠️ RETRY LIMIT (${state.maxRetries}x)\nPIVOT REQUIRED.`;
                        return;
                    }

                    output.output += `\n\n━━━━━━━━━━━━\n🔄 RETRY ${retries}/${state.maxRetries}`;
                    return;
                }

                if (output.output.includes("✅ PASS")) {
                    session.taskRetries.clear();
                    output.output += `\n\n━━━━━━━━━━━━\n✅ VERIFIED`;
                    return;
                }
            }

            // Append DAG Status and Guidance
            if (session.graph) {
                const readyTasks = session.graph.getReadyTasks();
                const guidance = readyTasks.length > 0
                    ? `\n👉 **READY TO EXECUTE**: ${readyTasks.map(t => `[${t.id}]`).join(", ")}`
                    : `\n⚠️ NO READY TASKS. Check dependencies or completion.`;

                output.output += `\n\n━━━━━━━━━━━━\n${session.graph.getTaskSummary()}${guidance}`;
            }

            output.output += `\n\n━━━━━━━━━━━━\n[DAG STEP: ${session.iterations}/${state.maxIterations}]`;
        },

        // Relentless Loop: Auto-continue until mission complete
        "assistant.done": async (input: any, output: any) => {
            if (!state.missionActive) return;

            const session = state.sessions.get(input.sessionID);
            if (!session?.enabled) return;

            // Check for mission completion signals
            const text = output.text || "";
            const isComplete =
                text.includes("✅ MISSION COMPLETE") ||
                text.includes("MISSION COMPLETE") ||
                text.includes("모든 태스크 완료") ||
                text.includes("All tasks completed") ||
                (session.graph && session.graph.isCompleted?.());

            if (isComplete) {
                // Mission complete - stop the loop
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
            // This makes the agent continue working without user input
            output.continue = true;
            output.continueMessage = "continue";
        },
    };
};

export default OrchestratorPlugin;
