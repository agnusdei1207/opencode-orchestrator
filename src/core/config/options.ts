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

const Limit = z.number().int().nonnegative();
const Temperature = z.number().finite().min(0).max(2);

const MissionLoopOptions = z
    .object({
        ledger: z.boolean().catch(D.ledger).default(D.ledger),
        markdownMemory: z.boolean().catch(D.markdownMemory).default(D.markdownMemory),
        maxEvidenceEvents: z.number().int().positive().catch(D.maxEvidenceEvents).default(D.maxEvidenceEvents),
    })
    .catch({ ...D });

export const OrchestratorOptionsSchema = z
    .object({
        customRendering: z.boolean().optional()
            .describe("Append a timestamp/step/duration footer to tool results. Default true."),
        agentTemperatures: z.record(z.string(), Temperature).optional()
            .describe("Sampling temperature per agent, keyed by exact agent name such as \"Worker\"."),
        agentConcurrency: z.record(z.string(), Limit).optional()
            .describe("Concurrent delegated tasks per agent, keyed by exact agent name. 0 means unlimited."),
        defaultConcurrency: Limit.optional()
            .describe("Concurrent delegated tasks for agents without their own limit. Default 10; 0 means unlimited."),
        acquisitionTimeoutMs: z.number().int().positive().optional()
            .describe("How long a delegated task may wait for a free slot, in milliseconds. Default 300000."),
        contextMaxTokens: z.number().int().positive().optional()
            .describe("Context window to assume for every model. Unset uses the limit the host reports."),
        missionLoop: MissionLoopOptions.optional()
            .describe("Mission ledger and markdown memory settings."),
    })
    .passthrough();

export interface ConcurrencyConfig {
    defaultConcurrency?: number;
    acquisitionTimeoutMs?: number;
    agentConcurrency?: Record<string, number>;
}

export interface OrchestratorOptions {
    customRendering: boolean;
    agentTemperatures: Record<string, number>;
    concurrency: ConcurrencyConfig;
    contextMaxTokens?: number;
    missionLoop: MissionRuntimeOptions;
}

export function parseOrchestratorOptions(source: unknown): OrchestratorOptions {
    const input = typeof source === "object" && source !== null ? source as Record<string, unknown> : {};
    const field = <T>(schema: z.ZodType<T>, value: unknown): T | undefined => {
        const parsed = schema.safeParse(value);
        return parsed.success ? parsed.data : undefined;
    };
    return {
        customRendering: field(z.boolean(), input.customRendering) ?? true,
        agentTemperatures: validEntries(input.agentTemperatures, Temperature),
        concurrency: {
            defaultConcurrency: field(Limit, input.defaultConcurrency),
            acquisitionTimeoutMs: field(z.number().int().positive(), input.acquisitionTimeoutMs),
            agentConcurrency: validEntries(input.agentConcurrency, Limit),
        },
        contextMaxTokens: field(z.number().int().positive(), input.contextMaxTokens),
        missionLoop: MissionLoopOptions.parse(input.missionLoop),
    };
}

/** Keep the valid entries of a record option and drop the rest. */
function validEntries(value: unknown, schema: z.ZodType<number>): Record<string, number> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).flatMap(([key, raw]) => {
        const parsed = schema.safeParse(raw);
        return parsed.success ? [[key, parsed.data]] : [];
    }));
}

export function orchestratorOptionsJsonSchema(): unknown {
    return z.toJSONSchema(OrchestratorOptionsSchema);
}
