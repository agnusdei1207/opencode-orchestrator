/**
 * Worker Agent (Subagent)
 * 
 * Implementation specialist with TDD-based file-level isolated work.
 * Reads .opencode for assignments and shared state.
 * Follows Commander instructions for sync fixes.
 */

import { AGENT_NAMES } from "../../shared/agent/index.js";
import type { AgentDefinition } from "../../shared/agent/index.js";
import { composePrompt } from "../prompts/registry.js";
import {
    // Common (no philosophy - Commander handles that)
    ROLE_MATRIX,
    ANTI_HALLUCINATION_CORE,
    SHARED_WORKSPACE,
    VERIFICATION_REQUIREMENTS,
    // Worker-specific
    WORKER_ROLE,
    WORKER_FORBIDDEN,
    WORKER_REQUIRED,
    WORKER_WORKFLOW,
    WORKER_QUALITY,
    // TDD & Isolation
    WORKER_TDD_WORKFLOW,
    WORKER_ISOLATION_TESTING,
    // File assignment
    WORKER_FILE_ASSIGNMENT,
    // Advanced Tools
    SHARED_LSP_TOOLS,
    SHARED_AST_TOOLS,
    MODULARITY_ENFORCEMENT,
    SKILLS_CAPABILITIES,
} from "../prompts/index.js";

/**
 * Compose Worker system prompt from modular fragments.
 * NOTE: No CORE_PHILOSOPHY - Commander holds the philosophy and delegates clear tasks.
 * NOTE: No HPFA - Worker is a terminal agent and must not be told to spawn in parallel.
 * Sections tagged verbose are dropped under the `compact` profile.
 */
const systemPrompt = composePrompt([
    WORKER_ROLE,
    ROLE_MATRIX,
    { body: MODULARITY_ENFORCEMENT, verbose: true },
    WORKER_FORBIDDEN,
    WORKER_REQUIRED,
    ANTI_HALLUCINATION_CORE,
    WORKER_WORKFLOW,
    WORKER_QUALITY,
    // File assignment from Commander
    WORKER_FILE_ASSIGNMENT,
    // TDD-based isolated work
    WORKER_TDD_WORKFLOW,
    WORKER_ISOLATION_TESTING,
    SHARED_LSP_TOOLS,
    { body: SHARED_AST_TOOLS, verbose: true },
    { body: SKILLS_CAPABILITIES, verbose: true },
    VERIFICATION_REQUIREMENTS,
    SHARED_WORKSPACE,
]);

export const worker: AgentDefinition = {
    id: AGENT_NAMES.WORKER,
    description: "Worker - TDD file-level implementation, reads .opencode, follows Commander",
    systemPrompt,
    canWrite: true,
    canBash: true,
};
