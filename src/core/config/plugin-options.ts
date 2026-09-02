import type { PluginOptions } from "@opencode-ai/plugin";
import type { ConcurrencyConfig } from "../agents/concurrency.js";
import { extractConcurrencyConfig } from "../agents/concurrency-config.js";
import {
    type MissionRuntimeOptions,
} from "../loop/mission-runtime-options.js";
import { parseContextMaxTokens, parseMissionLoopOptions } from "./options-schema.js";

type UnknownRecord = Record<string, unknown>;

export type MissionLoopPluginOptions = MissionRuntimeOptions;

export interface OrchestratorPluginOptions {
    concurrency: ConcurrencyConfig;
    missionLoop: MissionLoopPluginOptions;
    /** Explicit context window override; undefined resolves from model metadata. */
    contextMaxTokens?: number;
}

export function parseOrchestratorPluginOptions(options?: PluginOptions): OrchestratorPluginOptions {
    const source = isRecord(options) ? options : {};
    return {
        concurrency: extractConcurrencyConfig(source),
        missionLoop: readMissionLoopOptions(source.missionLoop),
        contextMaxTokens: parseContextMaxTokens(source.contextMaxTokens),
    };
}

function readMissionLoopOptions(value: unknown): MissionLoopPluginOptions {
    // Schema-driven, tolerant parse (invalid/missing fields -> defaults).
    return parseMissionLoopOptions(value);
}

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
