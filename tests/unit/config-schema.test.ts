import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
    orchestratorOptionsJsonSchema,
    parseMissionLoopOptions,
} from "../../src/core/config/options-schema.js";
import { DEFAULT_MISSION_RUNTIME_OPTIONS } from "../../src/core/loop/mission-runtime-options.js";

const repoRoot = path.resolve(__dirname, "../..");

describe("plugin options schema (Phase G)", () => {
    describe("tolerant missionLoop parsing", () => {
        it("returns defaults for non-objects", () => {
            expect(parseMissionLoopOptions(undefined)).toEqual(DEFAULT_MISSION_RUNTIME_OPTIONS);
            expect(parseMissionLoopOptions("nope")).toEqual(DEFAULT_MISSION_RUNTIME_OPTIONS);
            expect(parseMissionLoopOptions([1, 2])).toEqual(DEFAULT_MISSION_RUNTIME_OPTIONS);
        });

        it("fills missing fields with defaults", () => {
            expect(parseMissionLoopOptions({ ledger: false })).toEqual({
                ...DEFAULT_MISSION_RUNTIME_OPTIONS,
                ledger: false,
            });
        });

        it("falls back per-field on invalid values", () => {
            expect(parseMissionLoopOptions({ maxEvidenceEvents: -3 }).maxEvidenceEvents).toBe(
                DEFAULT_MISSION_RUNTIME_OPTIONS.maxEvidenceEvents,
            );
            expect(parseMissionLoopOptions({ maxEvidenceEvents: 2.5 }).maxEvidenceEvents).toBe(
                DEFAULT_MISSION_RUNTIME_OPTIONS.maxEvidenceEvents,
            );
            expect(parseMissionLoopOptions({ markdownMemory: "yes" }).markdownMemory).toBe(
                DEFAULT_MISSION_RUNTIME_OPTIONS.markdownMemory,
            );
        });

        it("accepts valid overrides", () => {
            expect(parseMissionLoopOptions({ ledger: false, maxEvidenceEvents: 50 })).toEqual({
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
