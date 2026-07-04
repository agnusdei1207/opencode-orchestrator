/**
 * Prompts Index
 *
 * Domain-oriented layout mirroring how prompts are consumed:
 * - shared/    cross-agent contracts and principles (role matrix, workspace
 *              schema, todo rules, anti-hallucination, philosophy)
 * - tools/     tool guidance shared by multiple agents
 * - commander/ planner/ worker/ reviewer/  per-agent fragments
 */

export * from "./shared/index.js";
export * from "./tools/index.js";
export * from "./commander/index.js";
export * from "./planner/index.js";
export * from "./worker/index.js";
export * from "./reviewer/index.js";

// Cross-cutting mandate constants live in src/shared (used beyond prompts)
export {
    AUTONOMOUS_MANDATE,
    PHASE_0_DIRECT_DISCOVERY,
    PHASE_1_THINK_ANALYSIS,
    PHASE_5_MSVP,
    HPFA_RULES
} from "../../shared/index.js";
