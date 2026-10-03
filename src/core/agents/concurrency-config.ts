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

type ScalarConfigKey =
    | "defaultConcurrency"
    | "acquisitionTimeoutMs"
    | "circuitFailureThreshold"
    | "circuitRecoveryTimeoutMs"
    | "halfOpenSuccessThreshold"
    | "resourcePressureMaxHeapPercent";

type LimitMapConfigKey = "agentConcurrency" | "providerConcurrency" | "modelConcurrency";

const SCALAR_FIELDS: ReadonlyArray<readonly [ScalarConfigKey, (value: unknown) => value is number]> = [
    ["defaultConcurrency", isValidLimit],
    ["acquisitionTimeoutMs", isPositiveInteger],
    ["circuitFailureThreshold", isPositiveInteger],
    ["circuitRecoveryTimeoutMs", isPositiveInteger],
    ["halfOpenSuccessThreshold", isPositiveInteger],
    ["resourcePressureMaxHeapPercent", isPercentage],
];

const LIMIT_MAP_FIELDS: readonly LimitMapConfigKey[] = [
    "agentConcurrency",
    "providerConcurrency",
    "modelConcurrency",
];

export function extractConcurrencyConfig(source: unknown): ConcurrencyConfig {
    if (!isRecord(source)) return {};

    const config: ConcurrencyConfig = {};
    for (const [key, isValid] of SCALAR_FIELDS) {
        const value = source[key];
        if (isValid(value)) config[key] = value;
    }

    for (const key of LIMIT_MAP_FIELDS) {
        const limits = readLimitMap(source[key]);
        if (limits) config[key] = limits;
    }

    return config;
}
