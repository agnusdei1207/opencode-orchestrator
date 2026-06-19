/**
 * Schema-driven plugin options (Builder learning, Phase G).
 *
 * Builder derives one JSON Schema from its config types so the TOML, the schema
 * file, and the editor UI never drift (`builder.schema.json` via schemars).
 * Orchestrator models its plugin-tuple options as Zod here, which is both the
 * runtime validator and the source for the exported JSON Schema.
 *
 * Parsing stays tolerant — invalid or missing fields fall back to defaults —
 * to preserve the previous hand-rolled behavior exactly.
 */
import { z } from "zod";
import { DEFAULT_MISSION_RUNTIME_OPTIONS } from "../loop/mission-runtime-options.js";

const D = DEFAULT_MISSION_RUNTIME_OPTIONS;

export const MissionLoopOptionsSchema = z
    .object({
        ledger: z.boolean().catch(D.ledger).default(D.ledger),
        markdownMemory: z.boolean().catch(D.markdownMemory).default(D.markdownMemory),
        maxEvidenceEvents: z
            .number()
            .int()
            .positive()
            .catch(D.maxEvidenceEvents)
            .default(D.maxEvidenceEvents),
    })
    .catch({ ...D });

const ConcurrencyMap = z.record(z.string(), z.number().int().positive());

/** Full plugin-tuple options object — used to generate the public JSON Schema. */
export const OrchestratorOptionsSchema = z
    .object({
        agentConcurrency: ConcurrencyMap.optional(),
        providerConcurrency: ConcurrencyMap.optional(),
        modelConcurrency: ConcurrencyMap.optional(),
        defaultConcurrency: z.number().int().positive().optional(),
        missionLoop: MissionLoopOptionsSchema.optional(),
    })
    .passthrough();

/** Tolerant parse of the `missionLoop` option block. */
export function parseMissionLoopOptions(value: unknown) {
    return MissionLoopOptionsSchema.parse(value);
}

/** JSON Schema for editor autocomplete / external validation. */
export function orchestratorOptionsJsonSchema(): unknown {
    return z.toJSONSchema(OrchestratorOptionsSchema);
}
