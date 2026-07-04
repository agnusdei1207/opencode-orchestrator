/**
 * Commander Agent
 * 
 * Master orchestrator with parallel execution capabilities.
 * Reads shared state (.opencode/) for loop continuation.
 * Handles sync issues by instructing Planner and Workers.
 */

import { AGENT_NAMES } from "../shared/agent/index.js";
import type { AgentDefinition } from "../shared/agent/index.js";
import { composePrompt } from "./prompts/registry.js";
import {
   // Common
   CORE_PHILOSOPHY,
   ROLE_MATRIX,
   ENVIRONMENT_DISCOVERY,
   ANTI_HALLUCINATION_CORE,
   TODO_RULES,
   COMPLETION_CONDITIONS,
   AUTONOMOUS_MANDATE,
   MISSION_STATUS_FORMAT,
   SHARED_WORKSPACE,
   // Commander-specific
   COMMANDER_ROLE,
   COMMANDER_FORBIDDEN,
   COMMANDER_REQUIRED,
   SEARCH_TOOLS,
   COMMANDER_EXECUTION,
   COMMANDER_PARALLEL,
   HYPER_PARALLEL_ENFORCEMENT,
   DELEGATION_RULES,
   COMMANDER_TODO_FORMAT,
   // Loop & sync handling
   COMMANDER_LOOP_CONTINUATION,
   COMMANDER_SYNC_HANDLING,
   COMMANDER_RECOVERY,
   // Advanced Tools
   SHARED_LSP_TOOLS,
   SHARED_AST_TOOLS,
} from "./prompts/index.js";

/**
 * Compose Commander system prompt from modular fragments.
 * Sections tagged verbose are dropped under the `compact` profile.
 */
const systemPrompt = composePrompt([
   CORE_PHILOSOPHY,
   COMMANDER_ROLE,
   ROLE_MATRIX,
   COMMANDER_FORBIDDEN,
   COMMANDER_REQUIRED,
   ENVIRONMENT_DISCOVERY,
   SEARCH_TOOLS,
   COMMANDER_EXECUTION,
   COMMANDER_PARALLEL,
   // HPFA is Commander-only: it mandates parallel spawning, which terminal
   // agents are forbidden to do.
   { body: HYPER_PARALLEL_ENFORCEMENT, verbose: true },
   DELEGATION_RULES,
   TODO_RULES,
   COMMANDER_TODO_FORMAT,
   // Loop, shared state, sync handling
   COMMANDER_LOOP_CONTINUATION,
   COMMANDER_SYNC_HANDLING,
   COMMANDER_RECOVERY,
   { body: SHARED_LSP_TOOLS, verbose: true },
   { body: SHARED_AST_TOOLS, verbose: true },
   SHARED_WORKSPACE,
   ANTI_HALLUCINATION_CORE,
   COMPLETION_CONDITIONS,
   AUTONOMOUS_MANDATE,
   MISSION_STATUS_FORMAT,
]);

export const commander: AgentDefinition = {
   id: AGENT_NAMES.COMMANDER,
   description: "Commander - orchestrator with parallel execution, loop state, and sync issue handling",
   systemPrompt,
   canWrite: true,
   canBash: true,
};
