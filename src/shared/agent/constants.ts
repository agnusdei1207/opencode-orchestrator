/**
 * Agent constants
 */

/**
 * Agent names constant.
 * Value must start with an uppercase letter.
 */
export const AGENT_NAMES = {
    COMMANDER: "Commander",
    PLANNER: "Planner",
    WORKER: "Worker",
    REVIEWER: "Reviewer", // Unit Review & Final Quality Gate (Conceptual Master)
} as const;
