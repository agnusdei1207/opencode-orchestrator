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
        for (const source of [undefined, null, "nope", 42, [1, 2]]) {
            expect(parseOrchestratorOptions(source)).toEqual({
                customRendering: true,
                agentTemperatures: {},
                contextMaxTokens: undefined,
                missionLoop: DEFAULT_MISSION_RUNTIME_OPTIONS,
            });
        }
    });

    it("returns exactly the four supported option keys", () => {
        expect(Object.keys(parseOrchestratorOptions({})).sort()).toEqual(
            ["agentTemperatures", "contextMaxTokens", "customRendering", "missionLoop"],
        );
    });

    it("ignores removed concurrency keys instead of rejecting the config", () => {
        const removed = {
            agentConcurrency: { Worker: 2 },
            defaultConcurrency: 3,
            acquisitionTimeoutMs: 500,
            providerConcurrency: { local: 0 },
            workStealingWorkers: 4,
        };
        expect(OrchestratorOptionsSchema.safeParse(removed).success).toBe(true);
        const options = parseOrchestratorOptions({ ...removed, contextMaxTokens: 64_000 });
        expect(options).toEqual({
            customRendering: true,
            agentTemperatures: {},
            contextMaxTokens: 64_000,
            missionLoop: DEFAULT_MISSION_RUNTIME_OPTIONS,
        });
        for (const key of Object.keys(removed)) expect(options).not.toHaveProperty(key);
        const properties = (orchestratorOptionsJsonSchema() as { properties: Record<string, unknown> }).properties;
        expect(Object.keys(properties).sort()).toEqual(
            ["agentTemperatures", "contextMaxTokens", "customRendering", "missionLoop"],
        );
    });

    it("falls back per field: one invalid value does not discard the valid ones", () => {
        const options = parseOrchestratorOptions({
            customRendering: "no",
            agentTemperatures: { Worker: 0.4, Planner: 3, Reviewer: "hot", Commander: 0 },
            contextMaxTokens: -5,
            missionLoop: { ledger: false, maxEvidenceEvents: 0 },
        });
        expect(options).toEqual({
            customRendering: true,
            agentTemperatures: { Worker: 0.4, Commander: 0 },
            contextMaxTokens: undefined,
            missionLoop: { ...DEFAULT_MISSION_RUNTIME_OPTIONS, ledger: false },
        });
        expect(parseOrchestratorOptions({ contextMaxTokens: 128_000 }).contextMaxTokens).toBe(128_000);
        expect(parseOrchestratorOptions({ contextMaxTokens: 1.5 }).contextMaxTokens).toBeUndefined();
        expect(parseOrchestratorOptions({ agentTemperatures: "warm" }).agentTemperatures).toEqual({});
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

    it("JSON schema is generated for input: defaulted missionLoop fields are not required", () => {
        type MissionLoopSchema = { properties: Record<string, unknown>; required?: string[] };
        const generated = orchestratorOptionsJsonSchema() as {
            required?: string[];
            properties: { missionLoop: MissionLoopSchema };
        };
        const committed = JSON.parse(
            readFileSync(path.join(repoRoot, "opencode-orchestrator.schema.json"), "utf8"),
        ) as typeof generated;
        for (const schema of [generated, committed]) {
            expect(schema.required).toBeUndefined();
            expect(Object.keys(schema.properties.missionLoop.properties).sort())
                .toEqual(["ledger", "markdownMemory", "maxEvidenceEvents"]);
            expect(schema.properties.missionLoop.required).toBeUndefined();
        }
    });
});
