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
    // Common
    CORE_PHILOSOPHY,
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
} from "../prompts/index.js";

/**
 * Compose Worker system prompt from modular fragments
 */
const systemPrompt = [
    CORE_PHILOSOPHY,
    WORKER_ROLE,
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
