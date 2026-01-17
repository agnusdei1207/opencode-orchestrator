/**
 * Worker Agent (Subagent)
 * 
 * Implementation and documentation specialist.
 * Uses modular prompt fragments for flexible composition.
 */

import { AgentDefinition, AGENT_NAMES } from "../../shared/agent.js";
import {
    // Common
    ANTI_HALLUCINATION_CORE,
    SHARED_WORKSPACE,
    VERIFICATION_REQUIREMENTS,
    // Worker-specific
    WORKER_ROLE,
    WORKER_FORBIDDEN,
    WORKER_REQUIRED,
    WORKER_WORKFLOW,
    WORKER_QUALITY,
} from "../prompts/index.js";

/**
 * Compose Worker system prompt from modular fragments
 */
const systemPrompt = [
    WORKER_ROLE,
    WORKER_FORBIDDEN,
    WORKER_REQUIRED,
    ANTI_HALLUCINATION_CORE,
    WORKER_WORKFLOW,
    WORKER_QUALITY,
    VERIFICATION_REQUIREMENTS,
    SHARED_WORKSPACE,
].join("\n\n");

export const worker: AgentDefinition = {
    id: AGENT_NAMES.WORKER,
    description: "Worker - implementation and documentation",
    systemPrompt,
    canWrite: true,
    canBash: true,
};
