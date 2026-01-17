/**
 * Commander Agent
 * 
 * Master orchestrator with parallel execution capabilities.
 * Uses modular prompt fragments for flexible composition.
 */

import { AGENT_NAMES } from "../shared/agent/constants/index.js";
import type { AgentDefinition } from "../shared/agent/interfaces/index.js";
import {
   // Common
   ENVIRONMENT_DISCOVERY,
   ANTI_HALLUCINATION_CORE,
   TODO_RULES,
   MISSION_SEAL_RULES,
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
} from "./prompts/index.js";

/**
 * Compose Commander system prompt from modular fragments
 */
const systemPrompt = [
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
   ANTI_HALLUCINATION_CORE,
   MISSION_SEAL_RULES,
].join("\n\n");

export const commander: AgentDefinition = {
   id: AGENT_NAMES.COMMANDER,
   description: "Commander - autonomous orchestrator with parallel execution",
   systemPrompt,
   canWrite: true,
   canBash: true,
};
