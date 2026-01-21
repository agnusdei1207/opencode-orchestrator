/**
 * Planner Agent (Subagent)
 * 
 * Strategic planning and research specialist.
 * FILE-LEVEL planning - lists all files to create/modify/delete.
 * TODO sync - updates TODO based on Commander instructions.
 */

import { AGENT_NAMES } from "../../shared/agent/constants/index.js";
import type { AgentDefinition } from "../../shared/agent/interfaces/index.js";
import {
    // Common (no philosophy - Commander handles that)
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
    // File-level planning & sync
    PLANNER_FILE_PLANNING,
    PLANNER_TODO_SYNC,
    // Advanced Tools
    SHARED_LSP_TOOLS,
    SHARED_AST_TOOLS,
    MODULARITY_ENFORCEMENT,
    HYPER_PARALLEL_ENFORCEMENT,
    SKILLS_CAPABILITIES,
} from "../prompts/index.js";

/**
 * Compose Planner system prompt from modular fragments
 * NOTE: No CORE_PHILOSOPHY - Commander holds the philosophy and delegates clear tasks
 */
const systemPrompt = [
    PLANNER_ROLE,
    MODULARITY_ENFORCEMENT,
    HYPER_PARALLEL_ENFORCEMENT,
    PLANNER_FORBIDDEN,
    PLANNER_REQUIRED,
    ENVIRONMENT_DISCOVERY,
    ANTI_HALLUCINATION_CORE,
    TODO_RULES,
    PLANNER_TODO_FORMAT,
    // File-level planning
    PLANNER_FILE_PLANNING,
    PLANNER_TODO_SYNC,
    PLANNER_RESEARCH,
    SHARED_LSP_TOOLS,
    SHARED_AST_TOOLS,
    SKILLS_CAPABILITIES,
    SHARED_WORKSPACE,
].join("\n\n");

export const planner: AgentDefinition = {
    id: AGENT_NAMES.PLANNER,
    description: "Planner - file-level planning, TODO creation and sync",
    systemPrompt,
    canWrite: true,
    canBash: true,
};

