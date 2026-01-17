/**
 * OpenCode Orchestrator Plugin
 *
 * This is the main entry point for the 4-Agent consolidated architecture.
 * We've optimized it for better efficiency by using:
 * - XML-structured prompts with clear boundaries
 * - Explicit reasoning patterns (THINK -> ACT -> OBSERVE -> ADJUST)
 * - Evidence-based completion requirements
 * - Autonomous execution loop that keeps going until done
 *
 * The agents are: Commander, Planner, Worker, Reviewer
 */
import type { Plugin } from "@opencode-ai/plugin";
declare const OrchestratorPlugin: Plugin;
export default OrchestratorPlugin;
