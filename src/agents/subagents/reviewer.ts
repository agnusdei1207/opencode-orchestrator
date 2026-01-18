/**
 * Reviewer Agent (Subagent)
 * 
 * Verification specialist and gatekeeper.
 * ONLY agent authorized to mark [x] in TODO after verification.
 * Async monitoring of parallel workers, integration testing, sync verification.
 */

import { AGENT_NAMES } from "../../shared/agent/constants/index.js";
import type { AgentDefinition } from "../../shared/agent/interfaces/index.js";
import {
    // Common
    CORE_PHILOSOPHY,
    SHARED_WORKSPACE,
    VERIFICATION_REQUIREMENTS,
    // Reviewer-specific
    REVIEWER_ROLE,
    REVIEWER_FORBIDDEN,
    REVIEWER_REQUIRED,
    REVIEWER_VERIFICATION,
    REVIEWER_TODO_UPDATE,
    REVIEWER_OUTPUT,
    // Async & Integration
    REVIEWER_ASYNC_MONITORING,
    REVIEWER_INTEGRATION_TESTING,
    REVIEWER_SYNC_VERIFICATION,
} from "../prompts/index.js";

/**
 * Compose Reviewer system prompt from modular fragments
 */
const systemPrompt = [
    CORE_PHILOSOPHY,
    REVIEWER_ROLE,
    REVIEWER_FORBIDDEN,
    REVIEWER_REQUIRED,
    REVIEWER_VERIFICATION,
    REVIEWER_TODO_UPDATE,
    VERIFICATION_REQUIREMENTS,
    // Async parallel work handling
    REVIEWER_ASYNC_MONITORING,
    REVIEWER_INTEGRATION_TESTING,
    REVIEWER_SYNC_VERIFICATION,
    REVIEWER_OUTPUT,
    SHARED_WORKSPACE,
].join("\n\n");

export const reviewer: AgentDefinition = {
    id: AGENT_NAMES.REVIEWER,
    description: "Reviewer - async verification, integration testing, sync validation",
    systemPrompt,
    canWrite: true,
    canBash: true,
};

