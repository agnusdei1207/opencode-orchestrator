/**
 * Plugin options: one Zod schema that is both the runtime parser and the
 * source of the published JSON Schema (scripts/gen-schema.ts).
 *
 * Parsing is tolerant: an invalid field falls back to its default, and keys
 * this version no longer reads are ignored.
 */
import { z } from "zod";
import { DEFAULT_MISSION_RUNTIME_OPTIONS, type MissionRuntimeOptions } from "../loop/mission-runtime-options.js";

const D = DEFAULT_MISSION_RUNTIME_OPTIONS;

export const OrchestratorOptionsSchema = z
    .object({
        customRendering: z.boolean().catch(true).default(true)
            .describe("Append a timestamp/step/duration footer to tool results. Default true."),
        agentTemperatures: z.record(z.string(), z.unknown()).catch({}).default({})
            .transform(entries => Object.fromEntries(Object.entries(entries).filter(
                (entry): entry is [string, number] => z.number().finite().min(0).max(2).safeParse(entry[1]).success,
            )))
            .describe("Sampling temperature (0 to 2) per agent, keyed by exact agent name such as \"Worker\"."),
        contextMaxTokens: z.number().int().positive().optional().catch(undefined)
            .describe("Context window to assume for every model. Unset uses the limit the host reports."),
        missionLoop: z.object({
            ledger: z.boolean().catch(D.ledger).default(D.ledger),
            markdownMemory: z.boolean().catch(D.markdownMemory).default(D.markdownMemory),
            maxEvidenceEvents: z.number().int().positive().catch(D.maxEvidenceEvents).default(D.maxEvidenceEvents),
        }).catch({ ...D }).default({ ...D })
            .describe("Mission ledger and markdown scratchpad settings."),
    })
    .passthrough();

export interface OrchestratorOptions {
    customRendering: boolean;
    agentTemperatures: Record<string, number>;
    contextMaxTokens?: number;
    missionLoop: MissionRuntimeOptions;
}

export function parseOrchestratorOptions(source: unknown): OrchestratorOptions {
    const input = typeof source === "object" && source !== null && !Array.isArray(source) ? source : {};
    const { customRendering, agentTemperatures, contextMaxTokens, missionLoop } = OrchestratorOptionsSchema.parse(input);
    return { customRendering, agentTemperatures, contextMaxTokens, missionLoop };
}

export function orchestratorOptionsJsonSchema(): unknown {
    return z.toJSONSchema(OrchestratorOptionsSchema, { io: "input" });
}
