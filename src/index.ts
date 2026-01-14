/**
 * OpenCode Orchestrator Plugin
 *
 * This is the main entry point for the 5-Agent structured architecture.
 * We've optimized it for weaker models by using:
 * - XML-structured prompts with clear boundaries
 * - Explicit reasoning patterns (THINK -> ACT -> OBSERVE -> ADJUST)
 * - Evidence-based completion requirements
 * - Autonomous execution loop that keeps going until done
 *
 * The agents are: Commander, Architect, Builder, Inspector, Recorder
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { AGENTS } from "./agents/definitions.js";
import { TaskGraph, type Task } from "./core/tasks.js";
import { state } from "./core/state.js";
import { callAgentTool } from "./tools/callAgent.js";
import { createSlashcommandTool, COMMANDS } from "./tools/slashCommand.js";
import { grepSearchTool, globSearchTool } from "./tools/search.js";
import { detectSlashCommand } from "./utils/common.js";
import {
    checkOutputSanity,
    RECOVERY_PROMPT,
    ESCALATION_PROMPT,
} from "./utils/sanity.js";

// ============================================================================
// Constants
// ============================================================================

// How many steps we allow before forcing a stop.
// Default is 500, but /task gets 1000 for longer missions.
const DEFAULT_MAX_STEPS = 500;
const TASK_COMMAND_MAX_STEPS = 1000;

// Just some fun emojis to make the logs prettier
const AGENT_EMOJI: Record<string, string> = {
    "architect": "🏗️",
    "builder": "🔨",
    "inspector": "🔍",
    "recorder": "💾",
    "commander": "🎯",
};

// This gets injected when the assistant finishes but mission isn't complete.
// Basically tells it "hey, you're not done yet, keep going!"
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
// Plugin Definition
// ============================================================================

const OrchestratorPlugin = async (input: PluginInput) => {
    const { directory, client } = input;

    // Track active sessions - each chat session gets its own state
    // so multiple users or conversations don't interfere with each other
    const sessions = new Map<string, {
        active: boolean;
        step: number;
        maxSteps: number;
        timestamp: number;
    }>();

    return {
        // -----------------------------------------------------------------
        // Tools we expose to the LLM
        // -----------------------------------------------------------------
        tool: {
            call_agent: callAgentTool,
            slashcommand: createSlashcommandTool(),
            grep_search: grepSearchTool(directory),
            glob_search: globSearchTool(directory),
        },

        // -----------------------------------------------------------------
        // Config hook - registers our commands and agents with OpenCode
        // -----------------------------------------------------------------
        config: async (config: Record<string, unknown>) => {
            const existingCommands = (config.command as Record<string, unknown>) ?? {};
            const existingAgents = (config.agent as Record<string, unknown>) ?? {};

            // Register all our slash commands (like /task, /plan, etc.)
            const orchestratorCommands: Record<string, unknown> = {};
            for (const [name, cmd] of Object.entries(COMMANDS)) {
                orchestratorCommands[name] = {
                    description: cmd.description,
                    template: cmd.template,
                    argumentHint: cmd.argumentHint,
                };
            }

            // Register the Commander agent so it shows up in the agent picker
            const orchestratorAgents: Record<string, unknown> = {
                Commander: {
                    name: "Commander",
                    description: "Autonomous orchestrator - executes until mission complete",
                    systemPrompt: AGENTS.commander.systemPrompt,
                },
            };

            // Merge with existing config, our stuff takes lower priority
            config.command = { ...orchestratorCommands, ...existingCommands };
            config.agent = { ...orchestratorAgents, ...existingAgents };
        },

        // -----------------------------------------------------------------
        // chat.message hook - runs when user sends a message
        // This is where we intercept commands and set up sessions
        // -----------------------------------------------------------------
        "chat.message": async (msgInput: any, msgOutput: any) => {
            const parts = msgOutput.parts as Array<{ type: string; text?: string }>;
            const textPartIndex = parts.findIndex(p => p.type === "text" && p.text);
            if (textPartIndex === -1) return;

            const originalText = parts[textPartIndex].text || "";
            const parsed = detectSlashCommand(originalText);
            const sessionID = msgInput.sessionID;
            const agentName = (msgInput.agent || "").toLowerCase();

            // If someone picks the Commander agent, auto-start a mission
            // This makes it so users don't need to type /task every time
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
                    anomalyCount: 0,
                });

                // Wrap their message in our task template for better results
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

            // Handle /task command - this gets more steps since tasks are usually big
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
                    anomalyCount: 0,
                });

                parts[textPartIndex].text = COMMANDS["task"].template.replace(
                    /\$ARGUMENTS/g,
                    parsed.args || "continue previous work"
                );
            } else if (parsed) {
                // Handle other slash commands (/plan, /auto, etc.)
                const command = COMMANDS[parsed.command];
                if (command) {
                    parts[textPartIndex].text = command.template.replace(
                        /\$ARGUMENTS/g,
                        parsed.args || "continue"
                    );
                }
            }
        },

        // -----------------------------------------------------------------
        // tool.execute.after hook - runs after any tool call completes
        // We use this to track progress and detect problems
        // -----------------------------------------------------------------
        "tool.execute.after": async (
            toolInput: { tool: string; sessionID: string; callID: string; arguments?: any },
            toolOutput: { title: string; output: string; metadata: any }
        ) => {
            const session = sessions.get(toolInput.sessionID);
            if (!session?.active) return;

            // Tick the step counter
            session.step++;
            session.timestamp = Date.now();

            const stateSession = state.sessions.get(toolInput.sessionID);

            // =========================================================
            // SANITY CHECK
            // Here we detect if the LLM output is gibberish or stuck in a loop.
            // This happens sometimes with weaker models - they just start
            // spitting out random characters or repeating the same thing.
            // When we catch it, we inject a recovery prompt to get back on track.
            // =========================================================
            if (toolInput.tool === "call_agent" && stateSession) {
                const sanityResult = checkOutputSanity(toolOutput.output);

                if (!sanityResult.isHealthy) {
                    // Uh oh, something's wrong with the output
                    stateSession.anomalyCount = (stateSession.anomalyCount || 0) + 1;
                    const agentName = toolInput.arguments?.agent as string || "unknown";

                    // Replace the garbage with a helpful warning message
                    // If this is the 2nd+ time, escalate to a stronger recovery
                    toolOutput.output = `⚠️ [${agentName.toUpperCase()}] OUTPUT ANOMALY DETECTED\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `⚠️ Gibberish/loop detected: ${sanityResult.reason}\n` +
                        `Anomaly count: ${stateSession.anomalyCount}\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                        (stateSession.anomalyCount >= 2 ? ESCALATION_PROMPT : RECOVERY_PROMPT);

                    return; // Don't do normal processing, let it recover first
                } else {
                    // Output looks good, reset the anomaly counter
                    if (stateSession.anomalyCount > 0) {
                        stateSession.anomalyCount = 0;
                    }
                    // Keep a snapshot of good output for potential recovery later
                    if (toolOutput.output.length < 5000) {
                        stateSession.lastHealthyOutput = toolOutput.output.substring(0, 1000);
                    }
                }
            }

            // Track which task is running if it's from the DAG
            if (toolInput.tool === "call_agent" && toolInput.arguments?.task && stateSession) {
                const taskIdMatch = toolInput.arguments.task.match(/\[(TASK-\d+)\]/i);
                if (taskIdMatch) {
                    stateSession.currentTask = taskIdMatch[1].toUpperCase();
                    stateSession.graph?.updateTask(stateSession.currentTask, { status: "running" });
                }

                // Prepend a nice header so we know which agent is working
                const agentName = toolInput.arguments.agent as string;
                const emoji = AGENT_EMOJI[agentName] || "🤖";
                toolOutput.output = `${emoji} [${agentName.toUpperCase()}] Working...\n\n` + toolOutput.output;
            }

            // Safety valve - stop if we've hit the step limit
            if (session.step >= session.maxSteps) {
                session.active = false;
                state.missionActive = false;
                return;
            }

            // =========================================================
            // TASK GRAPH PARSING
            // If the Architect outputs a JSON array of tasks, we parse it
            // and build a DAG so we can track dependencies and progress
            // =========================================================
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
                    } catch { /* malformed JSON, just ignore */ }
                }
            }

            // =========================================================
            // TASK STATUS UPDATES
            // Watch for PASS/FAIL signals from Inspector and update the graph
            // =========================================================
            if (stateSession?.graph) {
                const taskId = stateSession.currentTask;

                // Inspector said PASS - mark task complete, clear retry counter
                if (toolOutput.output.includes("✅ PASS") || toolOutput.output.includes("AUDIT RESULT: PASS")) {
                    if (taskId) {
                        stateSession.graph.updateTask(taskId, { status: "completed" });
                        stateSession.taskRetries.clear();
                        toolOutput.output += `\n\n━━━━━━━━━━━━\n✅ ${taskId} VERIFIED\n${stateSession.graph.getTaskSummary()}`;
                    }
                }
                // Inspector said FAIL - increment retry counter, maybe give up
                else if (toolOutput.output.includes("❌ FAIL") || toolOutput.output.includes("AUDIT RESULT: FAIL")) {
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

                // Show what tasks are ready to run next
                const readyTasks = stateSession.graph.getReadyTasks();
                if (readyTasks.length > 0) {
                    toolOutput.output += `\n👉 NEXT: ${readyTasks.map(t => `[${t.id}]`).join(", ")}`;
                }
            }

            // Always show the step counter at the bottom
            toolOutput.output += `\n\n[${session.step}/${session.maxSteps}]`;
        },

        // -----------------------------------------------------------------
        // assistant.done hook - runs when the LLM finishes responding
        // This is the heart of the "relentless loop" - we keep pushing it
        // to continue until we see MISSION COMPLETE or hit the limit
        // -----------------------------------------------------------------
        "assistant.done": async (assistantInput: any, assistantOutput: any) => {
            const sessionID = assistantInput.sessionID;
            const session = sessions.get(sessionID);

            if (!session?.active) return;

            // Gather all the text from the response
            const parts = assistantOutput.parts as Array<{ type: string; text?: string }> | undefined;
            const textContent = parts
                ?.filter((p: any) => p.type === "text" || p.type === "reasoning")
                .map((p: any) => p.text || "")
                .join("\n") || "";

            const stateSession = state.sessions.get(sessionID);

            // =========================================================
            // SANITY CHECK (again, for the final response)
            // Sometimes the whole response is garbage, not just tool output
            // =========================================================
            const sanityResult = checkOutputSanity(textContent);
            if (!sanityResult.isHealthy && stateSession) {
                stateSession.anomalyCount = (stateSession.anomalyCount || 0) + 1;
                session.step++;
                session.timestamp = Date.now();

                // Pick the right recovery prompt based on how many times this happened
                const recoveryText = stateSession.anomalyCount >= 2
                    ? ESCALATION_PROMPT
                    : RECOVERY_PROMPT;

                try {
                    if (client?.session?.prompt) {
                        await client.session.prompt({
                            path: { id: sessionID },
                            body: {
                                parts: [{
                                    type: "text",
                                    text: `⚠️ ANOMALY #${stateSession.anomalyCount}: ${sanityResult.reason}\n\n` +
                                        recoveryText +
                                        `\n\n[Recovery Step ${session.step}/${session.maxSteps}]`
                                }],
                            },
                        });
                    }
                } catch {
                    // Can't even inject recovery? Give up.
                    session.active = false;
                    state.missionActive = false;
                }
                return;
            }

            // Good response, reset the anomaly counter
            if (stateSession && stateSession.anomalyCount > 0) {
                stateSession.anomalyCount = 0;
            }

            // =========================================================
            // COMPLETION CHECK
            // If we see the magic words, we're done!
            // =========================================================
            if (textContent.includes("✅ MISSION COMPLETE") || textContent.includes("MISSION COMPLETE")) {
                session.active = false;
                state.missionActive = false;
                sessions.delete(sessionID);
                state.sessions.delete(sessionID);
                return;
            }

            // Let users bail out manually if needed
            if (textContent.includes("/stop") || textContent.includes("/cancel")) {
                session.active = false;
                state.missionActive = false;
                sessions.delete(sessionID);
                state.sessions.delete(sessionID);
                return;
            }

            session.step++;
            session.timestamp = Date.now();

            // Hit the limit? Time to stop.
            if (session.step >= session.maxSteps) {
                session.active = false;
                state.missionActive = false;
                return;
            }

            // =========================================================
            // THE RELENTLESS LOOP
            // Mission not complete? Inject a "keep going" prompt.
            // This is what makes Commander never give up.
            // =========================================================
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
                // First attempt failed, wait a bit and try simpler prompt
                try {
                    await new Promise(r => setTimeout(r, 500));
                    if (client?.session?.prompt) {
                        await client.session.prompt({
                            path: { id: sessionID },
                            body: { parts: [{ type: "text", text: "continue" }] },
                        });
                    }
                } catch {
                    // Both failed, probably a real problem. Stop the session.
                    session.active = false;
                    state.missionActive = false;
                }
            }
        },

        // -----------------------------------------------------------------
        // Event handler - cleans up when sessions are deleted
        // -----------------------------------------------------------------
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
