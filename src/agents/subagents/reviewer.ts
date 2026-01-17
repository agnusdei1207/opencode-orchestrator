/**
 * Reviewer Agent (Subagent)
 * 
 * Verification specialist and gatekeeper.
 * ONLY agent authorized to mark [x] in TODO after verification.
 * Uses modular prompt fragments for flexible composition.
 */

import { AgentDefinition, AGENT_NAMES } from "../../shared/agent.js";
import {
    // Common
    SHARED_WORKSPACE,
    VERIFICATION_REQUIREMENTS,
    // Reviewer-specific
    REVIEWER_ROLE,
    REVIEWER_FORBIDDEN,
    REVIEWER_REQUIRED,
    REVIEWER_VERIFICATION,
    REVIEWER_TODO_UPDATE,
    REVIEWER_OUTPUT,
} from "../prompts/index.js";

/**
 * Compose Reviewer system prompt from modular fragments
 */
const systemPrompt = [
    REVIEWER_ROLE,
    REVIEWER_FORBIDDEN,
    REVIEWER_REQUIRED,
    REVIEWER_VERIFICATION,
    REVIEWER_TODO_UPDATE,
    VERIFICATION_REQUIREMENTS,
    REVIEWER_OUTPUT,
    SHARED_WORKSPACE,
].join("\n\n");

export const reviewer: AgentDefinition = {
    id: AGENT_NAMES.REVIEWER,
    description: "Reviewer - verification and context management",
    systemPrompt,
    canWrite: true,
    canBash: true,
};
