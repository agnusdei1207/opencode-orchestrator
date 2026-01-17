/**
 * Agent Names
 */

export const AGENT_NAMES = {
    COMMANDER: "Commander",
    PLANNER: "Planner",
    WORKER: "Worker",
    REVIEWER: "Reviewer",
} as const;

export type AgentName = (typeof AGENT_NAMES)[keyof typeof AGENT_NAMES];
