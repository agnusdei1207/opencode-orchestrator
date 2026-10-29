import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
    orchestratorOptionsJsonSchema,
    OrchestratorOptionsSchema,
    parseOrchestratorOptions,
} from "../../src/core/config/options.js";
import { DEFAULT_MISSION_RUNTIME_OPTIONS } from "../../src/core/loop/mission-runtime-options.js";

const repoRoot = path.resolve(__dirname, "../..");

describe("plugin options schema", () => {
    it.each([undefined, true, false, "false", 0, null])("parses customRendering without coercing %s", value => {
        expect(parseOrchestratorOptions({ customRendering: value }).customRendering).toBe(value !== false);
    });

    it("returns defaults for non-object option sources", () => {
        for (const source of [undefined, null, "nope", 42]) {
            expect(parseOrchestratorOptions(source)).toEqual({
                customRendering: true,
                agentTemperatures: {},
                concurrency: { defaultConcurrency: undefined, acquisitionTimeoutMs: undefined, agentConcurrency: {} },
                contextMaxTokens: undefined,
                missionLoop: DEFAULT_MISSION_RUNTIME_OPTIONS,
            });
        }
    });

    it("accepts zero concurrency limits consistently with runtime unlimited limits", () => {
        expect(OrchestratorOptionsSchema.safeParse({
            defaultConcurrency: 0, agentConcurrency: { Worker: 0 },
        }).success).toBe(true);
        expect(parseOrchestratorOptions({ defaultConcurrency: 0, agentConcurrency: { Worker: 0 } }).concurrency)
            .toEqual({ defaultConcurrency: 0, acquisitionTimeoutMs: undefined, agentConcurrency: { Worker: 0 } });
        expect(orchestratorOptionsJsonSchema()).not.toHaveProperty("properties.workStealingWorkers");
    });

    it("drops invalid concurrency and context values per field", () => {
        const options = parseOrchestratorOptions({
            defaultConcurrency: -1,
            acquisitionTimeoutMs: 0,
            agentConcurrency: { Worker: 2, Planner: 1.5, Reviewer: "many" },
            contextMaxTokens: -5,
        });
        expect(options.concurrency).toEqual({
            defaultConcurrency: undefined,
            acquisitionTimeoutMs: undefined,
            agentConcurrency: { Worker: 2 },
        });
        expect(options.contextMaxTokens).toBeUndefined();
        expect(parseOrchestratorOptions({ contextMaxTokens: 128_000, acquisitionTimeoutMs: 500 })).toMatchObject({
            contextMaxTokens: 128_000,
            concurrency: { acquisitionTimeoutMs: 500 },
        });
    });

    it("ignores option keys this version no longer reads", () => {
        expect(OrchestratorOptionsSchema.safeParse({ providerConcurrency: { local: 0 } }).success).toBe(true);
        expect(parseOrchestratorOptions({ providerConcurrency: { local: 0 } })).not.toHaveProperty("providerConcurrency");
    });

    describe("tolerant missionLoop parsing", () => {
        const missionLoop = (value: unknown) => parseOrchestratorOptions({ missionLoop: value }).missionLoop;

        it("returns defaults for non-objects", () => {
            expect(missionLoop(undefined)).toEqual(DEFAULT_MISSION_RUNTIME_OPTIONS);
            expect(missionLoop("nope")).toEqual(DEFAULT_MISSION_RUNTIME_OPTIONS);
            expect(missionLoop([1, 2])).toEqual(DEFAULT_MISSION_RUNTIME_OPTIONS);
        });

        it("fills missing fields with defaults", () => {
            expect(missionLoop({ ledger: false })).toEqual({
                ...DEFAULT_MISSION_RUNTIME_OPTIONS,
                ledger: false,
            });
        });

        it("falls back per-field on invalid values", () => {
            expect(missionLoop({ maxEvidenceEvents: -3 }).maxEvidenceEvents).toBe(
                DEFAULT_MISSION_RUNTIME_OPTIONS.maxEvidenceEvents,
            );
            expect(missionLoop({ maxEvidenceEvents: 2.5 }).maxEvidenceEvents).toBe(
                DEFAULT_MISSION_RUNTIME_OPTIONS.maxEvidenceEvents,
            );
            expect(missionLoop({ markdownMemory: "yes" }).markdownMemory).toBe(
                DEFAULT_MISSION_RUNTIME_OPTIONS.markdownMemory,
            );
        });

        it("accepts valid overrides", () => {
            expect(missionLoop({ ledger: false, maxEvidenceEvents: 50 })).toEqual({
                ...DEFAULT_MISSION_RUNTIME_OPTIONS,
                ledger: false,
                maxEvidenceEvents: 50,
            });
        });
    });

    it("committed opencode-orchestrator.schema.json is in sync with the Zod source", () => {
        const committed = JSON.parse(
            readFileSync(path.join(repoRoot, "opencode-orchestrator.schema.json"), "utf8"),
        );
        expect(committed).toEqual(orchestratorOptionsJsonSchema());
    });
});
