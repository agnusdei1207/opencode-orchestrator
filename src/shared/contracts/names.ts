export const AGENT_NAMES = {
  // Core Agents (5)
  COMMANDER: "commander",    // Orchestrator - ReAct loop controller
  ARCHITECT: "architect",    // Planner + Strategist - Plan-and-Execute
  BUILDER: "builder",        // Coder + Visualist combined (full-stack)
  INSPECTOR: "inspector",    // Reviewer + Fixer combined (quality + fix)
  MEMORY: "memory",          // Recorder - persistent context
} as const;

export type AgentName = typeof AGENT_NAMES[keyof typeof AGENT_NAMES];
