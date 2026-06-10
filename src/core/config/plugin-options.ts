import type { PluginOptions } from "@opencode-ai/plugin";
import type { ConcurrencyConfig } from "../agents/concurrency.js";
import { extractConcurrencyConfig } from "../agents/concurrency-config.js";
import {
    DEFAULT_MISSION_RUNTIME_OPTIONS,
    type MissionRuntimeOptions,
} from "../loop/mission-runtime-options.js";

type UnknownRecord = Record<string, unknown>;

export type MissionLoopPluginOptions = MissionRuntimeOptions;

export interface OrchestratorPluginOptions {
    concurrency: ConcurrencyConfig;
    missionLoop: MissionLoopPluginOptions;
}

export function parseOrchestratorPluginOptions(options?: PluginOptions): OrchestratorPluginOptions {
    const source = isRecord(options) ? options : {};
    return {
        concurrency: extractConcurrencyConfig(source),
        missionLoop: readMissionLoopOptions(source.missionLoop),
    };
}

function readMissionLoopOptions(value: unknown): MissionLoopPluginOptions {
    if (!isRecord(value)) return DEFAULT_MISSION_RUNTIME_OPTIONS;

    return {
        ledger: readBoolean(value.ledger, DEFAULT_MISSION_RUNTIME_OPTIONS.ledger),
        markdownMemory: readBoolean(value.markdownMemory, DEFAULT_MISSION_RUNTIME_OPTIONS.markdownMemory),
        maxEvidenceEvents: readPositiveInteger(
            value.maxEvidenceEvents,
            DEFAULT_MISSION_RUNTIME_OPTIONS.maxEvidenceEvents,
        ),
    };
}

function readBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function readPositiveInteger(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
