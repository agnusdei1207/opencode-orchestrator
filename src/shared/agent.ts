/**
 * Agent Definitions
 * 
 * Agent names, types, and interfaces.
 */

// ============================================================================
// Agent Names
// ============================================================================

export const AGENT_NAMES = {
    COMMANDER: "Commander",         // Capital C like Sisyphus
    ARCHITECT: "Architect",
    BUILDER: "Builder",
    INSPECTOR: "Inspector",
    RECORDER: "Recorder",
    LIBRARIAN: "Librarian",
    RESEARCHER: "Researcher",
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
