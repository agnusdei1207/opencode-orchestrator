import { describe, expect, it } from "vitest";
import {
    extractConcurrencyConfig,
} from "../../src/core/agents/concurrency-config.js";
import { parseOrchestratorPluginOptions } from "../../src/core/config/plugin-options.js";

describe("concurrency config helpers", () => {
    it("extracts supported concurrency settings from plugin options", () => {
        const config = extractConcurrencyConfig({
            defaultConcurrency: 6,
            acquisitionTimeoutMs: 1500,
            circuitFailureThreshold: 4,
            circuitRecoveryTimeoutMs: 20_000,
            halfOpenSuccessThreshold: 3,
            resourcePressureMaxHeapPercent: 75,
            workStealingWorkers: {
                worker: 6,
                invalid: 0,
            },
            agentConcurrency: {
                commander: 1,
                worker: 10,
                invalid: -1,
                fractional: 1.5,
            },
            providerConcurrency: {
                anthropic: 3,
            },
            modelConcurrency: {
                "opencode/gpt-5.1-codex": 2,
            },
        });

        expect(config).toEqual({
            defaultConcurrency: 6,
            acquisitionTimeoutMs: 1500,
            circuitFailureThreshold: 4,
            circuitRecoveryTimeoutMs: 20_000,
            halfOpenSuccessThreshold: 3,
            resourcePressureMaxHeapPercent: 75,
            agentConcurrency: {
                commander: 1,
                worker: 10,
            },
            providerConcurrency: {
                anthropic: 3,
            },
            modelConcurrency: {
                "opencode/gpt-5.1-codex": 2,
            },
        });
    });

    it("parses orchestrator plugin options with mission-loop defaults", () => {
        expect(parseOrchestratorPluginOptions({
            agentConcurrency: { worker: 4 },
            missionLoop: {
                ledger: false,
                markdownMemory: true,
                maxEvidenceEvents: 8,
            },
        })).toEqual({
            customRendering: true,
            concurrency: {
                agentConcurrency: { worker: 4 },
            },
            contextMaxTokens: undefined,
            agentTemperatures: {},
            missionLoop: {
                ledger: false,
                markdownMemory: true,
                maxEvidenceEvents: 8,
            },
            strictReview: {
                enabled: false,
                maxReviewRejections: 3,
            },
        });
    });

    it("parses the opt-in strict review options and falls back for invalid values", () => {
        expect(parseOrchestratorPluginOptions({
            strictReview: true,
            maxReviewRejections: 5,
        }).strictReview).toEqual({ enabled: true, maxReviewRejections: 5 });
        expect(parseOrchestratorPluginOptions({
            strictReview: "yes",
            maxReviewRejections: 0,
        }).strictReview).toEqual({ enabled: false, maxReviewRejections: 3 });
    });

    it("falls back for invalid mission-loop option values", () => {
        expect(parseOrchestratorPluginOptions({
            missionLoop: {
                ledger: "no",
                markdownMemory: 1,
                maxEvidenceEvents: -1,
            },
        }).missionLoop).toEqual({
            ledger: true,
            markdownMemory: true,
            maxEvidenceEvents: 20,
        });
    });
});
