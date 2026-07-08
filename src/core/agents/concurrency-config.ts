import type { ConcurrencyConfig } from "./concurrency.js";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readLimitMap(value: unknown): Record<string, number> | undefined {
    if (!isRecord(value)) return undefined;

    const result: Record<string, number> = {};
    for (const [key, limit] of Object.entries(value)) {
        if (isValidLimit(limit)) {
            result[key] = limit;
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

function readPositiveIntegerMap(value: unknown): Record<string, number> | undefined {
    if (!isRecord(value)) return undefined;

    const result: Record<string, number> = {};
    for (const [key, count] of Object.entries(value)) {
        if (isPositiveInteger(count)) {
            result[key] = count;
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

function isValidLimit(value: unknown): value is number {
    return typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
    return typeof value === "number" &&
        Number.isInteger(value) &&
        value > 0;
}

function isPercentage(value: unknown): value is number {
    return typeof value === "number" &&
        Number.isFinite(value) &&
        value > 0 &&
        value <= 100;
}

export function extractConcurrencyConfig(source: unknown): ConcurrencyConfig {
    if (!isRecord(source)) return {};

    const config: ConcurrencyConfig = {};
    if (isValidLimit(source.defaultConcurrency)) {
        config.defaultConcurrency = source.defaultConcurrency;
    }
    if (isPositiveInteger(source.acquisitionTimeoutMs)) {
        config.acquisitionTimeoutMs = source.acquisitionTimeoutMs;
    }
    if (isPositiveInteger(source.circuitFailureThreshold)) {
        config.circuitFailureThreshold = source.circuitFailureThreshold;
    }
    if (isPositiveInteger(source.circuitRecoveryTimeoutMs)) {
        config.circuitRecoveryTimeoutMs = source.circuitRecoveryTimeoutMs;
    }
    if (isPositiveInteger(source.halfOpenSuccessThreshold)) {
        config.halfOpenSuccessThreshold = source.halfOpenSuccessThreshold;
    }
    if (isPercentage(source.resourcePressureMaxHeapPercent)) {
        config.resourcePressureMaxHeapPercent = source.resourcePressureMaxHeapPercent;
    }

    const agentConcurrency = readLimitMap(source.agentConcurrency);
    if (agentConcurrency) config.agentConcurrency = agentConcurrency;

    const providerConcurrency = readLimitMap(source.providerConcurrency);
    if (providerConcurrency) config.providerConcurrency = providerConcurrency;

    const modelConcurrency = readLimitMap(source.modelConcurrency);
    if (modelConcurrency) config.modelConcurrency = modelConcurrency;

    const workStealingWorkers = readPositiveIntegerMap(source.workStealingWorkers);
    if (workStealingWorkers) config.workStealingWorkers = workStealingWorkers;

    return config;
}
