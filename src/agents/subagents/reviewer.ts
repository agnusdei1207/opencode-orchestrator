/**
 * Reviewer Agent (Subagent)
 * 
 * Verification specialist and gatekeeper.
 * ONLY agent authorized to mark [x] in TODO after verification.
 * Async monitoring of parallel workers, integration testing, sync verification.
 */

import { AGENT_NAMES } from "../../shared/agent/index.js";
import type { AgentDefinition } from "../../shared/agent/index.js";
import { composePrompt } from "../prompts/registry.js";
import {
    // Common (no philosophy - Commander handles that)
    ROLE_MATRIX,
    SHARED_WORKSPACE,
    VERIFICATION_REQUIREMENTS,
    // Reviewer-specific
    REVIEWER_ROLE,
    REVIEWER_FORBIDDEN,
    REVIEWER_REQUIRED,
    REVIEWER_VERIFICATION,
    REVIEWER_TODO_UPDATE,
    EVIDENCE_FORMAT,
    // Async & Integration
    REVIEWER_ASYNC_MONITORING,
    REVIEWER_INTEGRATION_TESTING,
    REVIEWER_SYNC_VERIFICATION,
    // LSP Tools (Reviewer-specific gatekeeper workflow; SHARED_LSP_TOOLS
    // would duplicate the same diagnostics rule)
    REVIEWER_LSP_TOOLS,
    // Advanced Tools
    SHARED_AST_TOOLS,
    MODULARITY_ENFORCEMENT,
} from "../prompts/index.js";

/**
 * Compose Reviewer system prompt from modular fragments.
 * NOTE: No CORE_PHILOSOPHY - Commander holds the philosophy and delegates clear tasks.
 * NOTE: No HPFA - Reviewer is a terminal agent and must not be told to spawn in parallel.
 * Sections tagged verbose are dropped under the `compact` profile.
 */
const systemPrompt = composePrompt([
    REVIEWER_ROLE,
    ROLE_MATRIX,
    { body: MODULARITY_ENFORCEMENT, verbose: true },
    REVIEWER_FORBIDDEN,
    REVIEWER_REQUIRED,
    REVIEWER_VERIFICATION,
    REVIEWER_TODO_UPDATE,
    VERIFICATION_REQUIREMENTS,
    // Async parallel work handling
    REVIEWER_ASYNC_MONITORING,
    REVIEWER_INTEGRATION_TESTING,
    REVIEWER_SYNC_VERIFICATION,
    REVIEWER_LSP_TOOLS,
    { body: SHARED_AST_TOOLS, verbose: true },
    EVIDENCE_FORMAT,
    SHARED_WORKSPACE,
]);

export const reviewer: AgentDefinition = {
    id: AGENT_NAMES.REVIEWER,
    description: "Reviewer - async verification, integration testing, sync validation",
    systemPrompt,
    canWrite: true,
    canBash: true,
};

