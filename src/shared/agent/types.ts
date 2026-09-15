/**
 * Agent types and interfaces
 */
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
    circuitFailureThreshold?: number;
    circuitRecoveryTimeoutMs?: number;
    halfOpenSuccessThreshold?: number;
    resourcePressureMaxHeapPercent?: number;
    agentConcurrency?: Record<string, number>;
    providerConcurrency?: Record<string, number>;
    modelConcurrency?: Record<string, number>;
}
