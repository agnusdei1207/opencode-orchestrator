/**
 * Planner Agent (Subagent)
 * 
 * Strategic planning and research specialist.
 * Uses modular prompt fragments for flexible composition.
 */

import { AgentDefinition, AGENT_NAMES } from "../../shared/agent.js";
import {
    // Common
    ENVIRONMENT_DISCOVERY,
    ANTI_HALLUCINATION_CORE,
    TODO_RULES,
    SHARED_WORKSPACE,
    // Planner-specific
    PLANNER_ROLE,
    PLANNER_FORBIDDEN,
    PLANNER_REQUIRED,
    PLANNER_TODO_FORMAT,
    PLANNER_RESEARCH,
} from "../prompts/index.js";

/**
 * Compose Planner system prompt from modular fragments
 */
const systemPrompt = [
    PLANNER_ROLE,
    PLANNER_FORBIDDEN,
    PLANNER_REQUIRED,
    ENVIRONMENT_DISCOVERY,
    ANTI_HALLUCINATION_CORE,
    TODO_RULES,
    PLANNER_TODO_FORMAT,
    PLANNER_RESEARCH,
    SHARED_WORKSPACE,
].join("\n\n");

export const planner: AgentDefinition = {
    id: AGENT_NAMES.PLANNER,
    description: "Planner - strategic planning and research",
    systemPrompt,
    canWrite: true,
    canBash: true,
};
