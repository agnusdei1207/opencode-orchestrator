/**
 * Agent Definitions
 * 
 * Agent names, types, and interfaces.
 */

// ============================================================================
// Agent Names
// ============================================================================

export const AGENT_NAMES = {
    COMMANDER: "commander",
    ARCHITECT: "architect",
    BUILDER: "builder",
    INSPECTOR: "inspector",
    RECORDER: "recorder",
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
