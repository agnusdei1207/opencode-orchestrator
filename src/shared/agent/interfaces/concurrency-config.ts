/**
 * Concurrency limits configuration
 */
export interface ConcurrencyConfig {
    defaultConcurrency?: number;
    agentConcurrency?: Record<string, number>;
    providerConcurrency?: Record<string, number>;
    modelConcurrency?: Record<string, number>;
}
