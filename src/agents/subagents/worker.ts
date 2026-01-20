/**
 * Worker Agent (Subagent)
 * 
 * Implementation specialist with TDD-based file-level isolated work.
 * Reads .opencode for assignments and shared state.
 * Follows Commander instructions for sync fixes.
 */

import { AGENT_NAMES } from "../../shared/agent/constants/index.js";
import type { AgentDefinition } from "../../shared/agent/interfaces/index.js";
import {
    // Common (no philosophy - Commander handles that)
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
    // LSP Tools
    WORKER_LSP_TOOLS,
    // Advanced Tools
    SHARED_LSP_TOOLS,
    SHARED_AST_TOOLS,
    MODULARITY_ENFORCEMENT,
} from "../prompts/index.js";

/**
 * Compose Worker system prompt from modular fragments
 * NOTE: No CORE_PHILOSOPHY - Commander holds the philosophy and delegates clear tasks
 */
const systemPrompt = [
    WORKER_ROLE,
    MODULARITY_ENFORCEMENT,
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
    WORKER_LSP_TOOLS,
    SHARED_LSP_TOOLS,
    SHARED_AST_TOOLS,
    VERIFICATION_REQUIREMENTS,
    SHARED_WORKSPACE,
].join("\n\n");

export const worker: AgentDefinition = {
    id: AGENT_NAMES.WORKER,
    description: "Worker - TDD file-level implementation, reads .opencode, follows Commander",
    systemPrompt,
    canWrite: true,
    canBash: true,
};
