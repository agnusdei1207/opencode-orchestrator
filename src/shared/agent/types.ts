/**
 * Agent types and interfaces
 */
import { AGENT_NAMES } from "./constants.js";

/**
 * Agent definition for orchestrator
 */
export interface AgentDefinition {
    id: string;
    description: string;
    systemPrompt: string;
    canWrite: boolean;
    canBash: boolean;
}

/**
 * Concurrency limits configuration
 */
export interface ConcurrencyConfig {
    defaultConcurrency?: number;
    acquisitionTimeoutMs?: number;
    agentConcurrency?: Record<string, number>;
    providerConcurrency?: Record<string, number>;
    modelConcurrency?: Record<string, number>;
}

/**
 * Agent name type (derived from AGENT_NAMES)
 */
export type AgentName = (typeof AGENT_NAMES)[keyof typeof AGENT_NAMES];
