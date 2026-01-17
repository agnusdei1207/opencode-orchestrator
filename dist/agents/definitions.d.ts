/**
 * Agent Definitions Registry
 *
 * Consolidated agent architecture (v2):
 * - Commander: Master orchestrator
 * - Planner: Planning + Research
 * - Worker: Implementation + Documentation
 * - Reviewer: Verification + Context Management
 */
import type { AgentDefinition } from "../shared/agent/interfaces/index.js";
export declare const AGENTS: Record<string, AgentDefinition>;
