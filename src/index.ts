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

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { version: PLUGIN_VERSION } = require("../package.json");

import type { Plugin } from "@opencode-ai/plugin";
import { AGENTS } from "./agents/definitions.js";
import { state } from "./core/orchestrator/index.js";
import { callAgentTool } from "./tools/callAgent.js";
import { createSlashcommandTool, COMMANDS } from "./tools/slashCommand.js";
import { grepSearchTool, globSearchTool, mgrepTool } from "./tools/search.js";
import {
    runBackgroundTool,
    checkBackgroundTool,
    listBackgroundTool,
    killBackgroundTool,
} from "./tools/background-cmd/index.js";
import { ParallelAgentManager } from "./core/agents/index.js";
import { createAsyncAgentTools } from "./tools/parallel/index.js";
import { detectSlashCommand, formatTimestamp, formatElapsedTime } from "./utils/common.js";
import {
    checkOutputSanity,
    RECOVERY_PROMPT,
    ESCALATION_PROMPT,
} from "./utils/sanity.js";
import { webfetchTool, websearchTool, cacheDocsTool, codesearchTool } from "./tools/web/index.js";
import { MISSION, AGENT_EMOJI, AGENT_NAMES, TOOL_NAMES, TASK_STATUS, PART_TYPES, PROMPTS } from "./shared/constants.js";
import * as TodoEnforcer from "./core/loop/todo-enforcer.js";
import * as Toast from "./core/notification/toast.js";
import * as ProgressTracker from "./core/progress/tracker.js";
import { log, getLogPath } from "./core/agents/logger.js";

// ============================================================================
// Constants
// ============================================================================

// UNLIMITED MODE: Set to true for infinite execution (no step limit)
// When true, execution continues until all todos are complete or mission done
const UNLIMITED_MODE = true;

// Step limits (only used when UNLIMITED_MODE is false)
const DEFAULT_MAX_STEPS = UNLIMITED_MODE ? Infinity : 500;
const TASK_COMMAND_MAX_STEPS = UNLIMITED_MODE ? Infinity : 1000;

// AGENT_EMOJI is imported from shared/constants.js

// This gets injected when the assistant finishes but mission isn't complete.
// Now includes Todo enforcement for relentless execution
const CONTINUE_INSTRUCTION = `<auto_continue>
<status>Mission not complete. Keep executing.</status>

<rules>
1. DO NOT stop - mission is incomplete
2. DO NOT wait for user input
3. If previous action failed, try different approach
4. If agent returned nothing, proceed to next step
5. Check your todo list - complete ALL pending items
</rules>

<next_step>
1. Check todo list for incomplete items
2. Identify the highest priority pending task
3. Execute it NOW
4. Mark complete when done
5. Continue until ALL todos are complete
</next_step>

<completion_criteria>
You are ONLY done when:
- All todos are marked complete or cancelled
- All features are implemented and tested
- Final verification passes
Then output: ✅ MISSION COMPLETE
</completion_criteria>
</auto_continue>`;

// ============================================================================
// Plugin Definition
// ============================================================================

const OrchestratorPlugin: Plugin = async (input) => {
    const { directory, client } = input;

    // Log version on startup
    console.log(`[orchestrator] v${PLUGIN_VERSION} loaded`);
    console.log(`[orchestrator] Log file: ${getLogPath()}`);
    log("[index.ts] Plugin initialized", { version: PLUGIN_VERSION, directory });

    // =========================================================================
    // Initialize Core Systems
    // =========================================================================

    // Initialize toast system with OpenCode client for TUI display
    Toast.initToastClient(client);
    log("[index.ts] Toast notifications enabled with TUI");

    // Track active sessions - each chat session gets its own state
    // so multiple users or conversations don't interfere with each other
    const sessions = new Map<string, {
        active: boolean;
        step: number;
        maxSteps: number;
        timestamp: number;      // Last activity timestamp
        startTime: number;      // Session start time for total elapsed
        lastStepTime: number;   // Time of last step for step duration
    }>();

    // Initialize parallel agent manager
    const parallelAgentManager = ParallelAgentManager.getInstance(client, directory);
    const asyncAgentTools = createAsyncAgentTools(parallelAgentManager, client);
    log("[index.ts] ParallelAgentManager initialized");

    return {
        // -----------------------------------------------------------------
        // Tools we expose to the LLM
        // -----------------------------------------------------------------
        tool: {
            [TOOL_NAMES.CALL_AGENT]: callAgentTool,
            [TOOL_NAMES.SLASHCOMMAND]: createSlashcommandTool(),
            [TOOL_NAMES.GREP_SEARCH]: grepSearchTool(directory),
            [TOOL_NAMES.GLOB_SEARCH]: globSearchTool(directory),
            [TOOL_NAMES.MGREP]: mgrepTool(directory),  // Multi-pattern grep (parallel, Rust-powered)
            // Background task tools - run shell commands asynchronously
            [TOOL_NAMES.RUN_BACKGROUND]: runBackgroundTool,
            [TOOL_NAMES.CHECK_BACKGROUND]: checkBackgroundTool,
            [TOOL_NAMES.LIST_BACKGROUND]: listBackgroundTool,
            [TOOL_NAMES.KILL_BACKGROUND]: killBackgroundTool,
            // Web tools - documentation research and caching
            [TOOL_NAMES.WEBFETCH]: webfetchTool,
            [TOOL_NAMES.WEBSEARCH]: websearchTool,
            [TOOL_NAMES.CACHE_DOCS]: cacheDocsTool,
            [TOOL_NAMES.CODESEARCH]: codesearchTool,
            // Async agent tools - spawn agents in parallel sessions
            ...asyncAgentTools,
        },

        // -----------------------------------------------------------------
        // Config hook - registers our commands and agents with OpenCode
        // -----------------------------------------------------------------
        config: async (config: Record<string, unknown>) => {
            const existingCommands = (config.command as Record<string, unknown>) ?? {};
            const existingAgents = (config.agent as Record<string, { mode?: string; hidden?: boolean }>) ?? {};

            // Register all our slash commands (like /task, /plan, etc.)
            const orchestratorCommands: Record<string, unknown> = {};
            for (const [name, cmd] of Object.entries(COMMANDS)) {
                orchestratorCommands[name] = {
                    description: cmd.description,
                    template: cmd.template,
                    argumentHint: cmd.argumentHint,
                };
            }

            // Get Commander's system prompt
            const commanderPrompt = AGENTS[AGENT_NAMES.COMMANDER]?.systemPrompt || "";
            console.log(`[orchestrator] Commander prompt length: ${commanderPrompt.length} chars`);

            // Register Commander (primary) and all subagents
            // Subagents must be registered so Commander can invoke them via Task tool
            const orchestratorAgents: Record<string, unknown> = {
                // Primary agent - the main orchestrator
                [AGENT_NAMES.COMMANDER]: {
                    description: "Autonomous orchestrator - executes until mission complete",
                    mode: "primary",
                    prompt: commanderPrompt,
                    maxTokens: 64000,
                    thinking: { type: "enabled", budgetTokens: 32000 },
                    color: "#FF6B6B",
                },
                // Subagents - invoked by Commander via Task tool
                [AGENT_NAMES.ARCHITECT]: {
                    description: "Task decomposition and planning specialist",
                    mode: "subagent",
                    hidden: true,  // Only invoked programmatically
                    prompt: AGENTS[AGENT_NAMES.ARCHITECT]?.systemPrompt || "",
                    maxTokens: 32000,
                    color: "#9B59B6",
                },
                [AGENT_NAMES.BUILDER]: {
                    description: "Full-stack code implementation",
                    mode: "subagent",
                    hidden: true,
                    prompt: AGENTS[AGENT_NAMES.BUILDER]?.systemPrompt || "",
                    maxTokens: 32000,
                    color: "#E67E22",
                },
                [AGENT_NAMES.INSPECTOR]: {
                    description: "Quality verification and bug fixing",
                    mode: "subagent",
                    hidden: true,
                    prompt: AGENTS[AGENT_NAMES.INSPECTOR]?.systemPrompt || "",
                    maxTokens: 32000,
                    color: "#27AE60",
                },
                [AGENT_NAMES.RECORDER]: {
                    description: "Persistent progress tracking across sessions",
                    mode: "subagent",
                    hidden: true,
                    prompt: AGENTS[AGENT_NAMES.RECORDER]?.systemPrompt || "",
                    maxTokens: 16000,
                    color: "#3498DB",
                },
                [AGENT_NAMES.LIBRARIAN]: {
                    description: "Documentation research specialist - reduces hallucination",
                    mode: "subagent",
                    hidden: true,
                    prompt: AGENTS[AGENT_NAMES.LIBRARIAN]?.systemPrompt || "",
                    maxTokens: 16000,
                    color: "#4ECDC4",
                },
                [AGENT_NAMES.RESEARCHER]: {
                    description: "Pre-task investigation - gathers all info before implementation",
                    mode: "subagent",
                    hidden: true,
                    prompt: AGENTS[AGENT_NAMES.RESEARCHER]?.systemPrompt || "",
                    maxTokens: 16000,
                    color: "#45B7D1",
                },
            };

            // Demote existing build/plan agents to subagents to avoid conflicts
            const processedExistingAgents = { ...existingAgents };
            if (processedExistingAgents.build) {
                processedExistingAgents.build = {
                    ...processedExistingAgents.build,
                    mode: "subagent",
                    hidden: true,
                };
            }
            if (processedExistingAgents.plan) {
                processedExistingAgents.plan = {
                    ...processedExistingAgents.plan,
                    mode: "subagent",
                };
            }

            // Merge: our agents OVERRIDE existing ones (put ours LAST in spread)
            config.command = { ...existingCommands, ...orchestratorCommands };
            config.agent = { ...processedExistingAgents, ...orchestratorAgents };

            // Set Commander as the default agent
            (config as { default_agent?: string }).default_agent = AGENT_NAMES.COMMANDER;

            console.log(`[orchestrator] Registered agents: ${Object.keys(orchestratorAgents).join(", ")}`);
            console.log(`[orchestrator] Default agent: ${AGENT_NAMES.COMMANDER}`);
        },

        // -----------------------------------------------------------------
        // Event hook - handles OpenCode events (SDK official)
        // Replaces non-standard session.start/session.end hooks
        // -----------------------------------------------------------------
        event: async (input: { event: { type: string; properties?: Record<string, unknown> } }) => {
            const { event } = input;

            // Pass events to ParallelAgentManager for resource cleanup
            try {
                const manager = ParallelAgentManager.getInstance();
                manager.handleEvent(event as { type: string; properties?: { sessionID?: string; info?: { id?: string } } });
            } catch {
                // Manager not initialized yet, ignore
            }

            // Session created event
            if (event.type === "session.created") {
                const sessionID = event.properties?.id as string || "";
                log("[index.ts] event: session.created", { sessionID });
                Toast.presets.missionStarted(`Session ${sessionID.slice(0, 12)}...`);
            }

            // Session deleted/ended event
            if (event.type === "session.deleted") {
                const sessionID = (event.properties?.id as string) ||
                    (event.properties as { info?: { id?: string } })?.info?.id || "";
                const session = sessions.get(sessionID);
                if (session) {
                    const totalTime = Date.now() - session.startTime;
                    const duration = totalTime < 60000
                        ? `${Math.round(totalTime / 1000)}s`
                        : `${Math.round(totalTime / 60000)}m`;

                    log("[index.ts] event: session.deleted", {
                        sessionID,
                        steps: session.step,
                        duration
                    });

                    // Cleanup session state
                    sessions.delete(sessionID);
                    state.sessions.delete(sessionID);
                    ProgressTracker.clearSession(sessionID);

                    Toast.presets.sessionCompleted(sessionID, duration);
                }
            }

            // Session error event
            if (event.type === "session.error") {
                const sessionID = event.properties?.sessionId as string || "";
                const error = event.properties?.error as string || "Unknown error";
                log("[index.ts] event: session.error", { sessionID, error });
                Toast.presets.taskFailed("session", error.slice(0, 50));
            }
        },

        // -----------------------------------------------------------------
        // chat.message hook - runs when user sends a message
        // This is where we intercept commands and set up sessions
        // -----------------------------------------------------------------
        "chat.message": async (msgInput: any, msgOutput: any) => {
            const parts = msgOutput.parts as Array<{ type: string; text?: string }>;
            const textPartIndex = parts.findIndex(p => p.type === PART_TYPES.TEXT && p.text);
            if (textPartIndex === -1) return;

            const originalText = parts[textPartIndex].text || "";
            const parsed = detectSlashCommand(originalText);
            const sessionID = msgInput.sessionID;
            const agentName = (msgInput.agent || "").toLowerCase();

            log("[index.ts] chat.message hook", { sessionID, agent: agentName, textLength: originalText.length });

            // =========================================================================
            // Commander Auto-Mission Mode
            // When using Commander agent, ALWAYS apply mission mode template
            // This ensures orchestrator.ts behavior is always active
            // =========================================================================
            if (agentName === AGENT_NAMES.COMMANDER) {
                // Initialize session if not exists
                if (!sessions.has(sessionID)) {
                    const now = Date.now();
                    sessions.set(sessionID, {
                        active: true,
                        step: 0,
                        maxSteps: DEFAULT_MAX_STEPS,
                        timestamp: now,
                        startTime: now,
                        lastStepTime: now,
                    });
                    state.missionActive = true;
                    state.sessions.set(sessionID, {
                        enabled: true,
                        iterations: 0,
                        taskRetries: new Map(),
                        currentTask: "",
                        anomalyCount: 0,
                    });

                    // Initialize progress tracking for this session
                    ProgressTracker.startSession(sessionID);

                    // Show task started notification
                    Toast.presets.taskStarted(sessionID, AGENT_NAMES.COMMANDER);
                }

                // AUTO-APPLY mission mode template if not already a /task command
                // This ensures every Commander message triggers full autonomous execution
                if (!parsed || parsed.command !== "task") {
                    const taskTemplate = COMMANDS["task"].template;
                    const userMessage = parsed?.args || originalText;

                    parts[textPartIndex].text = taskTemplate.replace(
                        /\$ARGUMENTS/g,
                        userMessage || PROMPTS.CONTINUE
                    );

                    log("[index.ts] Auto-applied mission mode", { originalLength: originalText.length });
                }
            }

            // Handle explicit slash commands (for all agents)
            if (parsed) {
                const command = COMMANDS[parsed.command];
                if (command && agentName !== AGENT_NAMES.COMMANDER) {
                    // Apply template for non-Commander agents
                    parts[textPartIndex].text = command.template.replace(
                        /\$ARGUMENTS/g,
                        parsed.args || PROMPTS.CONTINUE
                    );
                } else if (command && parsed.command === "task") {
                    // Explicit /task on Commander: apply template
                    parts[textPartIndex].text = command.template.replace(
                        /\$ARGUMENTS/g,
                        parsed.args || PROMPTS.CONTINUE
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

            // Tick the step counter and track timing
            const now = Date.now();
            const stepDuration = formatElapsedTime(session.lastStepTime, now);
            const totalElapsed = formatElapsedTime(session.startTime, now);
            session.step++;
            session.timestamp = now;
            session.lastStepTime = now;

            const stateSession = state.sessions.get(toolInput.sessionID);

            // =========================================================
            // SANITY CHECK
            // Here we detect if the LLM output is gibberish or stuck in a loop.
            // This happens sometimes with weaker models - they just start
            // spitting out random characters or repeating the same thing.
            // When we catch it, we inject a recovery prompt to get back on track.
            // =========================================================
            if (toolInput.tool === TOOL_NAMES.CALL_AGENT && stateSession) {
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

            // Track which task is running and add agent header
            if (toolInput.tool === TOOL_NAMES.CALL_AGENT && toolInput.arguments?.task && stateSession) {
                const taskIdMatch = toolInput.arguments.task.match(/\[(TASK-\d+)\]/i);
                if (taskIdMatch) {
                    stateSession.currentTask = taskIdMatch[1].toUpperCase();
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
            // TASK STATUS TRACKING (simplified - no DAG)
            // Watch for PASS/FAIL signals from Inspector
            // =========================================================
            if (stateSession) {
                const taskId = stateSession.currentTask;

                // Inspector said PASS - clear retry counter
                if (toolOutput.output.includes("✅ PASS") || toolOutput.output.includes("AUDIT RESULT: PASS")) {
                    if (taskId) {
                        stateSession.taskRetries.clear();
                        toolOutput.output += `\n\n━━━━━━━━━━━━\n✅ ${taskId} VERIFIED`;
                    }
                }
                // Inspector said FAIL - increment retry counter
                else if (toolOutput.output.includes("❌ FAIL") || toolOutput.output.includes("AUDIT RESULT: FAIL")) {
                    if (taskId) {
                        const retries = (stateSession.taskRetries.get(taskId) || 0) + 1;
                        stateSession.taskRetries.set(taskId, retries);
                        if (retries >= state.maxRetries) {
                            toolOutput.output += `\n\n━━━━━━━━━━━━\n⚠️ ${taskId} FAILED (${retries}x)`;
                        } else {
                            toolOutput.output += `\n\n━━━━━━━━━━━━\n🔄 RETRY ${retries}/${state.maxRetries}`;
                        }
                    }
                }
            }

            // Always show the step counter with timestamp at the bottom
            const currentTime = formatTimestamp();
            toolOutput.output += `\n\n⏱️ [${currentTime}] Step ${session.step}/${session.maxSteps} | This step: ${stepDuration} | Total: ${totalElapsed}`;
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
                ?.filter((p: any) => p.type === PART_TYPES.TEXT || p.type === PART_TYPES.REASONING)
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
                                    type: PART_TYPES.TEXT,
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
            if (textContent.includes(MISSION.COMPLETE) || textContent.includes(MISSION.COMPLETE_TEXT)) {
                session.active = false;
                state.missionActive = false;

                // Show mission complete notification
                Toast.presets.missionComplete("Mission completed successfully");

                // Clear progress tracker
                ProgressTracker.clearSession(sessionID);

                sessions.delete(sessionID);
                state.sessions.delete(sessionID);
                return;
            }

            // Let users bail out manually if needed
            if (textContent.includes(MISSION.STOP_COMMAND) || textContent.includes(MISSION.CANCEL_COMMAND)) {
                session.active = false;
                state.missionActive = false;

                // Show task cancelled notification
                Toast.presets.taskFailed(sessionID, "Cancelled by user");

                ProgressTracker.clearSession(sessionID);

                sessions.delete(sessionID);
                state.sessions.delete(sessionID);
                return;
            }

            const now = Date.now();
            const stepDuration = formatElapsedTime(session.lastStepTime, now);
            const totalElapsed = formatElapsedTime(session.startTime, now);
            session.step++;
            session.timestamp = now;
            session.lastStepTime = now;
            const currentTime = formatTimestamp();

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

            // Record progress snapshot
            ProgressTracker.recordSnapshot(sessionID, {
                currentStep: session.step,
                maxSteps: session.maxSteps,
            });

            // Get progress info
            const progressInfo = ProgressTracker.formatCompact(sessionID);

            try {
                if (client?.session?.prompt) {
                    await client.session.prompt({
                        path: { id: sessionID },
                        body: {
                            parts: [{
                                type: PART_TYPES.TEXT,
                                text: CONTINUE_INSTRUCTION + `\n\n⏱️ [${currentTime}] Step ${session.step}/${session.maxSteps} | ${progressInfo} | This step: ${stepDuration} | Total: ${totalElapsed}`
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
                            body: { parts: [{ type: PART_TYPES.TEXT, text: PROMPTS.CONTINUE }] },
                        });
                    }
                } catch {
                    // Both failed, probably a real problem. Stop the session.
                    session.active = false;
                    state.missionActive = false;
                }
            }
        },
    };
};

// NOTE: Do NOT export functions from main index.ts!
// OpenCode treats ALL exports as plugin instances and calls them.
// Only default export the plugin.
export default OrchestratorPlugin;
