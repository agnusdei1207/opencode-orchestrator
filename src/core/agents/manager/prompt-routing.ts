import { AGENT_NAMES } from "../../../shared/index.js";
import { MemoryManager } from "../../memory/memory-manager.js";
import { AgentRegistry } from "../agent-registry.js";

export interface RoutedAgentPrompt {
  /** Host agent that runs the task: the agent itself when built in, otherwise Commander. */
  wireAgent: string;
  text: string;
}

/**
 * Build the delegated prompt. Built-in agents already carry their system
 * prompt in the host, so only custom agents get their role prepended.
 */
export async function buildRoutedAgentPrompt(
  directory: string,
  agent: string,
  prompt: string,
): Promise<RoutedAgentPrompt> {
  const agentRegistry = AgentRegistry.getInstance(directory);
  await agentRegistry.ready();
  const builtIn = (Object.values(AGENT_NAMES) as string[]).includes(agent);
  const definition = agentRegistry.getAgent(agent);
  const routedPrompt = builtIn || !definition
    ? prompt
    : `### AGENT ROLE: ${definition.id}\n${definition.description}\n\n${definition.systemPrompt}\n\n${prompt}`;
  const memory = MemoryManager.getInstance(directory).getContext(routedPrompt);
  return {
    wireAgent: builtIn ? agent : AGENT_NAMES.COMMANDER,
    text: memory ? `${memory}\n\n${routedPrompt}` : routedPrompt,
  };
}
