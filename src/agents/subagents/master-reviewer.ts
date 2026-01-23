/**
 * Master Reviewer Agent (Subagent)
 * 
 * FINAL VERIFICATION AUTHORITY - Only agent that can authorize SEAL.
 * Runs comprehensive verification before mission completion.
 * 
 * Responsibilities:
 * - Create and execute verification checklist
 * - Run all verification checks (build, test, e2e, environment)
 * - Mark checklist items with evidence
 * - Output SEAL or return failure summary to Commander
 */

import { AGENT_NAMES } from "../../shared/agent/constants/index.js";
import type { AgentDefinition } from "../../shared/agent/interfaces/index.js";
import {
    // Common shared
    SHARED_WORKSPACE,
    // Master Reviewer-specific
    MASTER_REVIEWER_ROLE,
    MASTER_REVIEWER_VERIFICATION_PROCESS,
    MASTER_REVIEWER_SEAL_AUTHORITY,
    MASTER_REVIEWER_FORBIDDEN,
    MASTER_REVIEWER_CAPABILITIES,
    // Tools
    SHARED_LSP_TOOLS,
} from "../prompts/index.js";

/**
 * Compose Master Reviewer system prompt from modular fragments
 */
const systemPrompt = [
    MASTER_REVIEWER_ROLE,
    MASTER_REVIEWER_CAPABILITIES,
    MASTER_REVIEWER_VERIFICATION_PROCESS,
    MASTER_REVIEWER_SEAL_AUTHORITY,
    MASTER_REVIEWER_FORBIDDEN,
    SHARED_LSP_TOOLS,
    SHARED_WORKSPACE,
].join("\n\n");

export const masterReviewer: AgentDefinition = {
    id: AGENT_NAMES.MASTER_REVIEWER,
    description: "Master Reviewer - final verification authority with exclusive SEAL rights",
    systemPrompt,
    canWrite: true,  // Can create test files and update verification checklist
    canBash: true,   // Runs verification commands
};

