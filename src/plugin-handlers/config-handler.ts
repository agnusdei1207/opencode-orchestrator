/**
 * Plugin Handlers - Config Handler
 * 
 * Registers commands and agents with OpenCode
 */

import { AGENTS } from "../agents/definitions.js";
import { COMMANDS } from "../tools/slashCommand.js";
import { AGENT_NAMES, AGENT_TOKENS } from "../shared/index.js";

/**
 * Create config handler for OpenCode
 */
export function createConfigHandler() {
    const commanderPrompt = AGENTS[AGENT_NAMES.COMMANDER]?.systemPrompt || "";

    return async (config: Record<string, unknown>) => {
        const existingCommands = (config.command as Record<string, unknown>) ?? {};
        const existingAgents = (config.agent as Record<string, { mode?: string; hidden?: boolean }>) ?? {};

        // Register all our slash commands (like /extreme-mission, /plan, etc.)
        const orchestratorCommands: Record<string, unknown> = {};
        for (const [name, cmd] of Object.entries(COMMANDS)) {
            orchestratorCommands[name] = {
                description: cmd.description,
                template: cmd.template,
                argumentHint: cmd.argumentHint,
            };
        }

        // Register Commander (primary) and consolidated subagents
        const orchestratorAgents: Record<string, unknown> = {
            // Primary agent - the main orchestrator
            [AGENT_NAMES.COMMANDER]: {
                description: "Autonomous orchestrator - executes until mission complete",
                mode: "primary",
                prompt: commanderPrompt,
                maxTokens: AGENT_TOKENS.PRIMARY_MAX_TOKENS,
                thinking: { type: "enabled", budgetTokens: AGENT_TOKENS.PRIMARY_THINKING_BUDGET },
                color: "#ffea98",
            },
            // Consolidated subagents (4 agents instead of 6)
            [AGENT_NAMES.PLANNER]: {
                description: "Strategic planning and research specialist",
                mode: "subagent",
                hidden: true,
                prompt: AGENTS[AGENT_NAMES.PLANNER]?.systemPrompt || "",
                maxTokens: AGENT_TOKENS.SUBAGENT_MAX_TOKENS,
                color: "#9B59B6",
            },
            [AGENT_NAMES.WORKER]: {
                description: "Implementation and documentation specialist",
                mode: "subagent",
                hidden: true,
                prompt: AGENTS[AGENT_NAMES.WORKER]?.systemPrompt || "",
                maxTokens: AGENT_TOKENS.SUBAGENT_MAX_TOKENS,
                color: "#E67E22",
            },
            [AGENT_NAMES.REVIEWER]: {
                description: "Verification and context management specialist",
                mode: "subagent",
                hidden: true,
                prompt: AGENTS[AGENT_NAMES.REVIEWER]?.systemPrompt || "",
                maxTokens: AGENT_TOKENS.SUBAGENT_MAX_TOKENS,
                color: "#27AE60",
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

        // Note: console.log removed to prevent TUI corruption
    };
}
