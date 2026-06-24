import { AGENT_NAMES, TOOL_NAMES } from "../../../shared/index.js";
import { MemoryManager } from "../../memory/memory-manager.js";
import { AgentRegistry } from "../agent-registry.js";

export interface RoutedAgentPrompt {
  wireAgent: string;
  text: string;
  tools: Record<string, boolean>;
}

export async function buildRoutedAgentPrompt(
  agent: string,
  prompt: string,
): Promise<RoutedAgentPrompt> {
  const agentRegistry = AgentRegistry.getInstance();
  await agentRegistry.ready();

  const wireAgent = resolveWireAgent(agent);
  const routedPrompt = buildRolePrompt(agent, prompt, wireAgent, agentRegistry);
  const memory = MemoryManager.getInstance().getContext(routedPrompt);
  const text = memory ? `${memory}\n\n${routedPrompt}` : routedPrompt;

  return {
    wireAgent,
    text,
    tools: createAgentTaskTools(wireAgent),
  };
}

function buildRolePrompt(
  agent: string,
  prompt: string,
  wireAgent: string,
  agentRegistry: AgentRegistry,
): string {
  const agentDef = agentRegistry.getAgent(agent);
  if (!agentDef) return prompt;
  if (wireAgent === agent) return prompt;

  return `### AGENT ROLE: ${agentDef.id}\n${agentDef.description}\n\n${agentDef.systemPrompt}\n\n${prompt}`;
}

function resolveWireAgent(agent: string): string {
  const knownAgents = Object.values(AGENT_NAMES) as string[];
  return knownAgents.includes(agent) ? agent : AGENT_NAMES.COMMANDER;
}

function createAgentTaskTools(wireAgent: string): Record<string, boolean> {
  const tools: Record<string, boolean> = {
    [TOOL_NAMES.SKILL]: true,
    [TOOL_NAMES.RUN_COMMAND]: true,
  };

  if (wireAgent === AGENT_NAMES.COMMANDER) {
    tools[TOOL_NAMES.DELEGATE_TASK] = true;
    tools[TOOL_NAMES.GET_TASK_RESULT] = true;
    tools[TOOL_NAMES.LIST_TASKS] = true;
    tools[TOOL_NAMES.CANCEL_TASK] = true;
  }

  return tools;
}
