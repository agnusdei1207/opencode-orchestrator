/**
 * Agent Definitions Registry
 * 
 * Consolidated agent architecture (v2):
 * - Commander: Master orchestrator
 * - Planner: Planning + Research
 * - Worker: Implementation + Documentation
 * - Reviewer: Verification + Context Management
 */

import { AgentDefinition, AGENT_NAMES } from "../shared/agent.js";
import { commander } from "./commander.js";
import { planner } from "./consolidated/planner.js";
import { worker } from "./consolidated/worker.js";
import { reviewer } from "./consolidated/reviewer.js";

export const AGENTS: Record<string, AgentDefinition> = {
  [AGENT_NAMES.COMMANDER]: commander,
  [AGENT_NAMES.PLANNER]: planner,
  [AGENT_NAMES.WORKER]: worker,
  [AGENT_NAMES.REVIEWER]: reviewer,
};
