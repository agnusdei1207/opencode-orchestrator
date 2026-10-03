/**
 * Plugin Handlers - Config Handler
 * 
 * Registers commands and agents with OpenCode
 */

import type { Config } from "@opencode-ai/plugin";
import { AGENTS } from "../agents/definitions.js";
import { COMMANDS } from "../tools/slashCommand.js";
import { AGENT_NAMES } from "../shared/index.js";
import { isRecord } from "../shared/core/guards.js";

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
        ...defaults,
        ...existing,
    };

    if (permission !== undefined) {
        agent.permission = permission;
    }

    return agent;
}

function agentPrompt(name: string): string {
    return AGENTS[name]?.systemPrompt || "";
}

/** Commander (primary) and the consolidated subagents, in registration order. */
function orchestratorAgentDefaults(): Record<string, AgentConfig> {
    return {
        // Primary agent - the main orchestrator
        [AGENT_NAMES.COMMANDER]: {
            description: "Autonomous orchestrator - executes until mission complete",
            mode: "primary",
            prompt: agentPrompt(AGENT_NAMES.COMMANDER),
            color: "#ffea98",
        },
        // Subagents
        [AGENT_NAMES.PLANNER]: {
            description: "Strategic planning and research specialist",
            mode: "subagent",
            hidden: true,
            prompt: agentPrompt(AGENT_NAMES.PLANNER),
            color: "#9B59B6",
        },
        [AGENT_NAMES.WORKER]: {
            description: "Implementation and documentation specialist",
            mode: "subagent",
            hidden: true,
            prompt: agentPrompt(AGENT_NAMES.WORKER),
            color: "#E67E22",
        },
        [AGENT_NAMES.REVIEWER]: {
            description: "Module-level verification specialist",
            mode: "subagent",
            hidden: true,
            prompt: agentPrompt(AGENT_NAMES.REVIEWER),
            color: "#27AE60",
        },
    };
}

function orchestratorCommands(): Record<string, unknown> {
    const commands: Record<string, unknown> = {};
    for (const [name, cmd] of Object.entries(COMMANDS)) {
        commands[name] = {
            description: cmd.description,
            template: cmd.template,
        };
    }
    return commands;
}

function orchestratorAgents(
    existingAgents: Record<string, AgentConfig>,
    globalPermission: unknown,
): Record<string, AgentConfig> {
    const agents: Record<string, AgentConfig> = {};
    for (const [name, defaults] of Object.entries(orchestratorAgentDefaults())) {
        agents[name] = defineAgent(existingAgents[name], defaults, globalPermission);
    }
    return agents;
}

/**
 * Create config handler for OpenCode
 */
export function createConfigHandler() {
    return async (config: Config & UnknownRecord) => {
        const mutableConfig = config as MutableConfig;

        const existingCommands = mutableConfig.command ?? {};
        const existingAgents = mutableConfig.agent ?? {};
        const globalPermission = mutableConfig.permission;

        mutableConfig.command = { ...orchestratorCommands(), ...existingCommands };
        mutableConfig.agent = { ...existingAgents, ...orchestratorAgents(existingAgents, globalPermission) };

        // Note: console.log removed to prevent TUI corruption
    };
}
