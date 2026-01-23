/**
 * list_agents Tool
 * 
 * Lists all available agents, including built-in and custom templates.
 */

import { tool } from "@opencode-ai/plugin";
import { AgentRegistry } from "../../core/agents/agent-registry.js";
import { OUTPUT_LABEL } from "../../shared/index.js";

export const createListAgentsTool = () => tool({
    description: "List all available agents for delegation, including built-in and custom templates.",
    args: {},
    async execute() {
        const registry = AgentRegistry.getInstance();
        const agentNames = registry.listAgents();

        if (agentNames.length === 0) {
            return `${OUTPUT_LABEL.INFO} No agents registered.`;
        }

        let output = `${OUTPUT_LABEL.INFO} Available Agents:\n\n`;

        for (const name of agentNames) {
            const def = registry.getAgent(name);
            if (def) {
                output += `- **${name}**: ${def.description}\n`;
            }
        }

        return output;
    }
});
