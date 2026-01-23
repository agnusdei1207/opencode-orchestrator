/**
 * Agent names constant
 * Value must be start with uppercase letter
 */
export const AGENT_NAMES = {
    COMMANDER: "Commander",
    PLANNER: "Planner",
    WORKER: "Worker",
    REVIEWER: "Reviewer", // Unit Review & Final Quality Gate (Conceptual Master)
} as const;
