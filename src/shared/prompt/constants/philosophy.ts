/**
 * Core Philosophy Phases
 * 
 * The 4-phase cycle: Explore → Learn → Adapt → Act
 */

export const PHILOSOPHY_PHASES = {
    EXPLORE: "EXPLORE",
    LEARN: "LEARN",
    ADAPT: "ADAPT",
    ACT: "ACT",
} as const;

/**
 * Execution Cycle Phases
 * 
 * The 4-step execution pattern: THINK → ACT → OBSERVE → ADJUST
 */
export const EXECUTION_CYCLE = {
    THINK: "THINK",
    ACT: "ACT",
    OBSERVE: "OBSERVE",
    ADJUST: "ADJUST",
} as const;

export const EXECUTION_CYCLE_STEPS = `1. ${EXECUTION_CYCLE.THINK} - Reason about the task
2. ${EXECUTION_CYCLE.ACT} - Execute the work
3. ${EXECUTION_CYCLE.OBSERVE} - Check the result
4. ${EXECUTION_CYCLE.ADJUST} - Fix if needed`;

/**
 * Core philosophy tagline
 */
export const PHILOSOPHY_TAGLINE = "Explore → Learn → Adapt → Act";
export const PHILOSOPHY_QUOTE = "Like an astronaut landing on unknown planets — never assume, always discover.";
export const PHILOSOPHY_LEARN_PRINCIPLE = "LEARN = DOCUMENT: What you discover, you record. Your learnings become the team's knowledge.";

