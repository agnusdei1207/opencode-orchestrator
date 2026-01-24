/**
 * Prompts Index
 */

// 01 Philosophy
export * from "./01_philosophy/index.js";
export {
    AUTONOMOUS_MANDATE,
    PHASE_0_DIRECT_DISCOVERY,
    PHASE_1_THINK_ANALYSIS,
    PHASE_5_MSVP,
    HPFA_RULES
} from "../../shared/index.js";

// 02 Discovery
export * from "./02_discovery/index.js";

// 03 Planning
export * from "./03_planning/index.js";

// 04 Execution
export * from "./04_execution/index.js";

// 05 Verification
export * from "./05_verification/index.js";

// 06 Mission
export * from "./06_mission/index.js";

// 07 Agents
export * from "./07_agents/commander/commander_role.js";
export * from "./07_agents/commander/commander_identity.js";
export * from "./07_agents/commander/commander_forbidden.js";
export * from "./07_agents/commander/commander_required.js";
export * from "./07_agents/commander/commander_mandate.js";

export * from "./07_agents/planner/planner_identity.js";
export * from "./07_agents/planner/planner_forbidden.js";
export * from "./07_agents/planner/planner_required.js";
export * from "./07_agents/planner/planner_mandate.js";

export * from "./07_agents/worker/worker_identity.js";
export * from "./07_agents/worker/worker_forbidden.js";
export * from "./07_agents/worker/worker_required.js";
export * from "./07_agents/worker/worker_mandate.js";

export * from "./07_agents/reviewer/reviewer_identity.js";
export * from "./07_agents/reviewer/reviewer_forbidden.js";
export * from "./07_agents/reviewer/reviewer_required.js";
export * from "./07_agents/reviewer/reviewer_mandate.js";

// 08 Tools
export * from "./08_tools/index.js";
