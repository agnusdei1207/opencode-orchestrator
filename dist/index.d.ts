/**
 * OpenCode Orchestrator Plugin
 *
 * This is the main entry point for the 4-Agent consolidated architecture.
 * Handlers are modularized in src/plugin-handlers/ for maintainability.
 *
 * The agents are: Commander, Planner, Worker, Reviewer
 */
import type { Plugin } from "@opencode-ai/plugin";
declare const OrchestratorPlugin: Plugin;
export default OrchestratorPlugin;
