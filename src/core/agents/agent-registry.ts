/**
 * Agent Registry - Manages built-in and custom agent definitions
 */

import { AGENTS as BUILTIN_AGENTS } from "../../agents/definitions.js";
import type { AgentDefinition } from "../../shared/agent/interfaces/index.js";
import { log } from "./logger.js";
import * as fs from "fs/promises";
import * as path from "path";
import { PATHS } from "../../shared/index.js";

import { z } from "zod";

// Schema for Agent Definition
const AgentDefinitionSchema = z.object({
    id: z.string(), // ID is required inside the definition object
    description: z.string(),
    systemPrompt: z.string(),
    mode: z.enum(["primary", "subagent"]).optional(),
    color: z.string().optional(),
    hidden: z.boolean().optional(),
    thinking: z.boolean().optional(),
    maxTokens: z.number().optional(),
    budgetTokens: z.number().optional(),
    canWrite: z.boolean(), // Required per interface
    canBash: z.boolean(), // Required per interface
});

export class AgentRegistry {
    private static instance: AgentRegistry;
    private agents: Map<string, AgentDefinition> = new Map();
    private directory: string = "";

    private constructor() {
        // Load built-in agents
        for (const [name, def] of Object.entries(BUILTIN_AGENTS)) {
            this.agents.set(name, def);
        }
    }

    public static getInstance(): AgentRegistry {
        if (!AgentRegistry.instance) {
            AgentRegistry.instance = new AgentRegistry();
        }
        return AgentRegistry.instance;
    }

    public setDirectory(dir: string): void {
        this.directory = dir;
        this.loadCustomAgents();
    }

    /**
     * Get agent definition by name
     */
    public getAgent(name: string): AgentDefinition | undefined {
        return this.agents.get(name);
    }

    /**
     * List all available agent names
     */
    public listAgents(): string[] {
        return Array.from(this.agents.keys());
    }

    /**
     * Add or update an agent definition
     */
    public registerAgent(name: string, def: AgentDefinition): void {
        this.agents.set(name, def);
        log(`[AgentRegistry] Registered agent: ${name}`);
    }

    /**
     * Load custom agents from .opencode/agents.json
     */
    private async loadCustomAgents(): Promise<void> {
        if (!this.directory) return;

        const agentsConfigPath = path.join(this.directory, PATHS.AGENTS_CONFIG);
        try {
            const content = await fs.readFile(agentsConfigPath, "utf-8");
            const customAgents = JSON.parse(content);

            if (typeof customAgents === "object" && customAgents !== null) {
                for (const [name, def] of Object.entries(customAgents)) {
                    const result = AgentDefinitionSchema.safeParse(def);
                    if (result.success) {
                        this.registerAgent(name, def as AgentDefinition);
                    } else {
                        log(`[AgentRegistry] Invalid custom agent definition for: ${name}. Errors: ${result.error.message}`);
                    }
                }
            }
        } catch (error) {
            // File might not exist, ignore
            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError.code !== "ENOENT") {
                log(`[AgentRegistry] Error loading custom agents: ${error}`);
            }
        }
    }
}
