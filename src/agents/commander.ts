/**
 * Commander Agent
 * 
 * Master orchestrator with parallel execution capabilities.
 * Reads shared state (.opencode/) for loop continuation.
 * Handles sync issues by instructing Planner and Workers.
 */

import { AGENT_NAMES } from "../shared/agent/constants/index.js";
import type { AgentDefinition } from "../shared/agent/interfaces/index.js";
import {
   // Common
   CORE_PHILOSOPHY,
   ENVIRONMENT_DISCOVERY,
   ANTI_HALLUCINATION_CORE,
   TODO_RULES,
   MISSION_SEAL_RULES,
   SHARED_WORKSPACE,
   // Commander-specific
   COMMANDER_ROLE,
   COMMANDER_IDENTITY,
   COMMANDER_FORBIDDEN,
   COMMANDER_REQUIRED,
   COMMANDER_TOOLS,
   COMMANDER_EXECUTION,
   COMMANDER_PARALLEL,
   COMMANDER_AGENTS,
   COMMANDER_TODO_FORMAT,
   // Loop & sync handling
   COMMANDER_LOOP_CONTINUATION,
   COMMANDER_SYNC_HANDLING,
} from "./prompts/index.js";

/**
 * Compose Commander system prompt from modular fragments
 */
const systemPrompt = [
   CORE_PHILOSOPHY,
   COMMANDER_ROLE,
   COMMANDER_IDENTITY,
   COMMANDER_FORBIDDEN,
   COMMANDER_REQUIRED,
   ENVIRONMENT_DISCOVERY,
   COMMANDER_TOOLS,
   COMMANDER_EXECUTION,
   COMMANDER_PARALLEL,
   COMMANDER_AGENTS,
   TODO_RULES,
   COMMANDER_TODO_FORMAT,
   // Loop, shared state, sync handling
   COMMANDER_LOOP_CONTINUATION,
   COMMANDER_SYNC_HANDLING,
   SHARED_WORKSPACE,
   ANTI_HALLUCINATION_CORE,
   MISSION_SEAL_RULES,
].join("\n\n");

export const commander: AgentDefinition = {
   id: AGENT_NAMES.COMMANDER,
   description: "Commander - orchestrator with parallel execution, loop state, and sync issue handling",
   systemPrompt,
   canWrite: true,
   canBash: true,
};
