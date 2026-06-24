/**
 * Plugin Handlers - Config Handler
 * 
 * Registers commands and agents with OpenCode
 */

import type { Config } from "@opencode-ai/plugin";
import { AGENTS } from "../agents/definitions.js";
import { COMMANDS } from "../tools/slashCommand.js";
import { AGENT_NAMES } from "../shared/index.js";
import type { ConcurrencyConfig } from "../core/agents/concurrency.js";
import {
    extractConcurrencyConfig,
    hasConcurrencyConfig,
} from "../core/agents/concurrency-config.js";

type UnknownRecord = Record<string, unknown>;
type PermissionAction = "ask" | "allow" | "deny";
type AgentConfig = UnknownRecord & {
    mode?: "subagent" | "primary" | "all" | string;
    hidden?: boolean;
    permission?: unknown;
};
type MutableConfig = Omit<Config, "command" | "agent" | "permission" | "default_agent"> & UnknownRecord & {
    command?: Record<string, unknown>;
    agent?: Record<string, AgentConfig>;
    default_agent?: string;
    permission?: unknown;
};

interface ConfigHandlerOptions {
    onConcurrencyConfig?: (config: ConcurrencyConfig) => void;
}

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPermissionAction(value: unknown): value is PermissionAction {
    return value === "ask" || value === "allow" || value === "deny";
}

function mergePermission(globalPermission: unknown, agentPermission: unknown): unknown {
    if (agentPermission === undefined) {
        return globalPermission;
    }

    if (isRecord(globalPermission) && isRecord(agentPermission)) {
        return { ...globalPermission, ...agentPermission };
    }

    if (isPermissionAction(globalPermission) && isRecord(agentPermission)) {
        return { "*": globalPermission, ...agentPermission };
    }

    return agentPermission;
}

function defineAgent(
    existing: AgentConfig | undefined,
    defaults: AgentConfig,
    globalPermission: unknown,
): AgentConfig {
    const permission = mergePermission(globalPermission, existing?.permission);
    const agent = {
        ...existing,
        ...defaults,
    };

    if (permission !== undefined) {
        agent.permission = permission;
    }

    return agent;
}

/**
 * Create config handler for OpenCode
 */
export function createConfigHandler(options: ConfigHandlerOptions = {}) {
    return async (config: Config & UnknownRecord) => {
        const mutableConfig = config as MutableConfig;

        if (hasConcurrencyConfig(config)) {
            options.onConcurrencyConfig?.(extractConcurrencyConfig(config));
        }

        const commanderPrompt = AGENTS[AGENT_NAMES.COMMANDER]?.systemPrompt || "";
        const plannerPrompt = AGENTS[AGENT_NAMES.PLANNER]?.systemPrompt || "";
        const workerPrompt = AGENTS[AGENT_NAMES.WORKER]?.systemPrompt || "";
        const reviewerPrompt = AGENTS[AGENT_NAMES.REVIEWER]?.systemPrompt || "";

        const existingCommands = mutableConfig.command ?? {};
        const existingAgents = mutableConfig.agent ?? {};
        const globalPermission = mutableConfig.permission;

        // Register all our slash commands 
        const orchestratorCommands: Record<string, unknown> = {};
        for (const [name, cmd] of Object.entries(COMMANDS)) {
            orchestratorCommands[name] = {
                description: cmd.description,
                template: cmd.template,
                argumentHint: cmd.argumentHint,
            };
        }

        // Register Commander (primary) and consolidated subagents (4 agents)
        const orchestratorAgents: Record<string, AgentConfig> = {
            // Primary agent - the main orchestrator
            [AGENT_NAMES.COMMANDER]: defineAgent(existingAgents[AGENT_NAMES.COMMANDER], {
                description: "Autonomous orchestrator - executes until mission complete",
                mode: "primary",
                prompt: commanderPrompt,
                color: "#ffea98",
            }, globalPermission),
            // Subagents
            [AGENT_NAMES.PLANNER]: defineAgent(existingAgents[AGENT_NAMES.PLANNER], {
                description: "Strategic planning and research specialist",
                mode: "subagent",
                hidden: true,
                prompt: plannerPrompt,
                color: "#9B59B6",
            }, globalPermission),
            [AGENT_NAMES.WORKER]: defineAgent(existingAgents[AGENT_NAMES.WORKER], {
                description: "Implementation and documentation specialist",
                mode: "subagent",
                hidden: true,
                prompt: workerPrompt,
                color: "#E67E22",
            }, globalPermission),
            [AGENT_NAMES.REVIEWER]: defineAgent(existingAgents[AGENT_NAMES.REVIEWER], {
                description: "Module-level verification specialist",
                mode: "subagent",
                hidden: true,
                prompt: reviewerPrompt,
                color: "#27AE60",
            }, globalPermission),
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
        mutableConfig.command = { ...existingCommands, ...orchestratorCommands };
        mutableConfig.agent = { ...processedExistingAgents, ...orchestratorAgents };

        // Set Commander as the default agent
        mutableConfig.default_agent = AGENT_NAMES.COMMANDER;

        // Note: console.log removed to prevent TUI corruption
    };
}
