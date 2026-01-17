/**
 * Agent Definitions
 * 
 * Agent names, types, and interfaces.
 * 
 * Architecture (v2 - Consolidated):
 * - Commander: Master orchestrator
 * - Planner: Strategic planning + research (was: Architect + Researcher)
 * - Worker: Implementation + documentation (was: Builder + Librarian)
 * - Reviewer: Verification + context management (was: Inspector + Recorder)
 */

// ============================================================================
// Agent Names (Consolidated - 4 agents)
// ============================================================================

export const AGENT_NAMES = {
    // Primary agents
    COMMANDER: "Commander",    // Master orchestrator
    PLANNER: "Planner",        // Planning + Research
    WORKER: "Worker",          // Implementation + Docs
    REVIEWER: "Reviewer",      // Verification + Context
} as const;

export type AgentName = (typeof AGENT_NAMES)[keyof typeof AGENT_NAMES];

// ============================================================================
// Agent Definition Interface
// ============================================================================

export interface AgentDefinition {
    id: string;
    description: string;
    systemPrompt: string;
    canWrite: boolean;
    canBash: boolean;
}

