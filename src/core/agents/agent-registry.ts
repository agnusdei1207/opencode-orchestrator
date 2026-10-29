/**
 * Agent Registry - Manages built-in and custom agent definitions
 */

import { AGENTS as BUILTIN_AGENTS } from "../../agents/definitions.js";
import type { AgentDefinition } from "../../shared/agent/index.js";
import { log } from "./logger.js";
import * as fs from "fs/promises";
import * as path from "path";
import { PATHS } from "../../shared/index.js";

import { z } from "zod";
import { parse as parseJsonc } from "jsonc-parser";

// Schema for Agent Definition
const AgentDefinitionSchema = z.object({
    id: z.string(), // ID is required inside the definition object
    description: z.string(),
    systemPrompt: z.string(),
    mode: z.enum(["primary", "subagent"]).optional(),
    color: z.string().optional(),
    hidden: z.boolean().optional(),
    canWrite: z.boolean(), // Required per interface
    canBash: z.boolean(), // Required per interface
});

/**
 * One registry per project directory: custom agents come from that project's
 * .opencode/agents.json, and one OpenCode process can serve several projects.
 */
export class AgentRegistry {
    private static readonly instances = new Map<string, AgentRegistry>();
    private agents: Map<string, AgentDefinition> = new Map();
    private readonly loadPromise: Promise<void>;

    private constructor(private readonly directory: string) {
        // Load built-in agents
        for (const [name, def] of Object.entries(BUILTIN_AGENTS)) {
            this.agents.set(name, def);
        }
        this.loadPromise = this.loadCustomAgents();
    }

    public static getInstance(directory: string): AgentRegistry {
        const key = path.resolve(directory);
        let registry = AgentRegistry.instances.get(key);
        if (!registry) {
            registry = new AgentRegistry(key);
            AgentRegistry.instances.set(key, registry);
        }
        return registry;
    }

    public static _resetForTesting(): void {
        AgentRegistry.instances.clear();
    }

    public async ready(): Promise<void> {
        await this.loadPromise;
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
            // Tolerate comments and trailing commas in hand-edited agents config.
            const customAgents = parseJsonc(content);

            if (typeof customAgents === "object" && customAgents !== null) {
                this.registerCustomAgents(customAgents);
            }
        } catch (error) {
            // File might not exist, ignore
            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError.code !== "ENOENT") {
                log(`[AgentRegistry] Error loading custom agents: ${error}`);
            }
        }
    }

    private registerCustomAgents(customAgents: object): void {
        for (const [name, def] of Object.entries(customAgents)) {
            const result = AgentDefinitionSchema.safeParse(def);
            if (result.success) {
                this.registerAgent(name, result.data);
            } else {
                log(`[AgentRegistry] Invalid custom agent definition for: ${name}. Errors: ${result.error.message}`);
            }
        }
    }
}
