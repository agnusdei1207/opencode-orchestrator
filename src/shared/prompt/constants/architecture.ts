/**
 * Architecture Rules - Core system behavior constants
 * 
 * These define the immutable rules about agent hierarchy and spawning.
 * Used by prompts to ensure consistent messaging across all agents.
 */

import { AGENT_NAMES } from "../../agent/constants/names.js";

/**
 * Agent hierarchy roles
 */
export const AGENT_ROLES = {
    /** Only Commander can spawn other agents */
    SPAWNER: AGENT_NAMES.COMMANDER,
    /** Terminal agents cannot spawn any sub-agents */
    TERMINAL_AGENTS: [AGENT_NAMES.PLANNER, AGENT_NAMES.WORKER, AGENT_NAMES.REVIEWER] as const,
} as const;

/**
 * Terminal node messaging - used in forbidden actions
 */
export const TERMINAL_NODE = {
    /** Label for terminal node concept */
    LABEL: "TERMINAL node",
    /** Reason why terminal nodes can't spawn */
    REASON: "prevents infinite recursion",
    /** What to do instead of spawning */
    ALTERNATIVE: `Report back to ${AGENT_NAMES.COMMANDER} with specific blockers`,
} as const;

/**
 * Spawning restriction messages
 */
export const SPAWNING_RULES = {
    /** Who can spawn */
    SPAWNER_ONLY: `${AGENT_NAMES.COMMANDER} is the ONLY agent who can spawn other agents`,
    /** What terminal nodes should do */
    TERMINAL_BEHAVIOR: `Complete your assigned task directly without delegation`,
    /** Error message for blocked spawn attempts */
    BLOCKED_MESSAGE: `You are a ${TERMINAL_NODE.LABEL} - ${TERMINAL_NODE.REASON}`,
} as const;

/**
 * Core architecture rules as a single exportable constant
 */
export const ARCHITECTURE_RULES = {
    AGENT_ROLES,
    TERMINAL_NODE,
    SPAWNING_RULES,
} as const;
