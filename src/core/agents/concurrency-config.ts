import type { ConcurrencyConfig } from "./concurrency.js";

type UnknownRecord = Record<string, unknown>;

const CONCURRENCY_KEYS = [
    "defaultConcurrency",
    "agentConcurrency",
    "providerConcurrency",
    "modelConcurrency",
] as const;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readLimitMap(value: unknown): Record<string, number> | undefined {
    if (!isRecord(value)) return undefined;

    const result: Record<string, number> = {};
    for (const [key, limit] of Object.entries(value)) {
        if (typeof limit === "number" && Number.isFinite(limit) && limit >= 0) {
            result[key] = limit;
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

export function extractConcurrencyConfig(source: unknown): ConcurrencyConfig {
    if (!isRecord(source)) return {};

    const config: ConcurrencyConfig = {};
    if (typeof source.defaultConcurrency === "number" && source.defaultConcurrency >= 0) {
        config.defaultConcurrency = source.defaultConcurrency;
    }

    const agentConcurrency = readLimitMap(source.agentConcurrency);
    if (agentConcurrency) config.agentConcurrency = agentConcurrency;

    const providerConcurrency = readLimitMap(source.providerConcurrency);
    if (providerConcurrency) config.providerConcurrency = providerConcurrency;

    const modelConcurrency = readLimitMap(source.modelConcurrency);
    if (modelConcurrency) config.modelConcurrency = modelConcurrency;

    return config;
}

export function hasConcurrencyConfig(source: unknown): boolean {
    if (!isRecord(source)) return false;
    return CONCURRENCY_KEYS.some((key) => source[key] !== undefined);
}

export function mergeConcurrencyConfig(
    base: ConcurrencyConfig,
    override: ConcurrencyConfig,
): ConcurrencyConfig {
    return {
        ...base,
        ...override,
        agentConcurrency: {
            ...base.agentConcurrency,
            ...override.agentConcurrency,
        },
        providerConcurrency: {
            ...base.providerConcurrency,
            ...override.providerConcurrency,
        },
        modelConcurrency: {
            ...base.modelConcurrency,
            ...override.modelConcurrency,
        },
    };
}
