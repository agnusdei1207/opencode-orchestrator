import { describe, expect, it } from "vitest";
import {
    extractConcurrencyConfig,
    hasConcurrencyConfig,
    mergeConcurrencyConfig,
} from "../../src/core/agents/concurrency-config.js";
import { parseOrchestratorPluginOptions } from "../../src/core/config/plugin-options.js";

describe("concurrency config helpers", () => {
    it("extracts supported concurrency settings from plugin options", () => {
        const config = extractConcurrencyConfig({
            defaultConcurrency: 6,
            agentConcurrency: {
                commander: 1,
                worker: 10,
                invalid: -1,
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

    it("detects legacy top-level concurrency keys", () => {
        expect(hasConcurrencyConfig({ agentConcurrency: { worker: 2 } })).toBe(true);
        expect(hasConcurrencyConfig({ model: "opencode/gpt-5.1-codex" })).toBe(false);
    });

    it("merges plugin option defaults with config hook overrides", () => {
        expect(mergeConcurrencyConfig(
            {
                defaultConcurrency: 4,
                agentConcurrency: { worker: 6, reviewer: 2 },
                providerConcurrency: { anthropic: 3 },
            },
            {
                agentConcurrency: { worker: 10 },
                modelConcurrency: { "opencode/gpt-5.1-codex": 1 },
            },
        )).toEqual({
            defaultConcurrency: 4,
            agentConcurrency: { worker: 10, reviewer: 2 },
            providerConcurrency: { anthropic: 3 },
            modelConcurrency: { "opencode/gpt-5.1-codex": 1 },
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
            concurrency: {
                agentConcurrency: { worker: 4 },
            },
            missionLoop: {
                ledger: false,
                markdownMemory: true,
                maxEvidenceEvents: 8,
            },
        });
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
