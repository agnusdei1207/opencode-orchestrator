import type { PluginOptions } from "@opencode-ai/plugin";
import type { ConcurrencyConfig } from "../agents/concurrency.js";
import { extractConcurrencyConfig } from "../agents/concurrency-config.js";
import {
    type MissionRuntimeOptions,
} from "../loop/mission-runtime-options.js";
import { parseAgentTemperatures, parseContextMaxTokens, parseCustomRendering, parseMaxReviewRejections, parseMissionLoopOptions, parseStrictReview } from "./options-schema.js";
import type { StrictReviewOptions } from "../review/strict-review.js";
import { isRecord } from "../../shared/core/guards.js";

type MissionLoopPluginOptions = MissionRuntimeOptions;

interface OrchestratorPluginOptions {
    customRendering: boolean;
    concurrency: ConcurrencyConfig;
    missionLoop: MissionLoopPluginOptions;
    /** Explicit context window override; undefined resolves from model metadata. */
    contextMaxTokens?: number;
    agentTemperatures: Record<string, number>;
    strictReview: StrictReviewOptions;
}

export function parseOrchestratorPluginOptions(options?: PluginOptions): OrchestratorPluginOptions {
    const source = isRecord(options) ? options : {};
    return {
        customRendering: parseCustomRendering(source.customRendering),
        concurrency: extractConcurrencyConfig(source),
        missionLoop: readMissionLoopOptions(source.missionLoop),
        contextMaxTokens: parseContextMaxTokens(source.contextMaxTokens),
        agentTemperatures: parseAgentTemperatures(source.agentTemperatures),
        strictReview: {
            enabled: parseStrictReview(source.strictReview),
            maxReviewRejections: parseMaxReviewRejections(source.maxReviewRejections),
        },
    };
}

function readMissionLoopOptions(value: unknown): MissionLoopPluginOptions {
    // Schema-driven, tolerant parse (invalid/missing fields -> defaults).
    return parseMissionLoopOptions(value);
}
