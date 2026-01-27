/**
 * list_agents Tool
 * 
 * Lists all available agents from the central definition registry.
 */

import { tool } from "@opencode-ai/plugin";
import { AGENTS } from "../../agents/definitions.js";
import { OUTPUT_LABEL } from "../../shared/index.js";

export const createListAgentsTool = () => tool({
    description: "List all available specialized agents for delegation.",
    args: {},
    async execute() {
        const agentNames = Object.keys(AGENTS);

        if (agentNames.length === 0) {
            return `${OUTPUT_LABEL.INFO} No agents defined.`;
        }

        let output = `${OUTPUT_LABEL.INFO} Available Agents:\n\n`;

        for (const name of agentNames) {
            const def = AGENTS[name];
            output += `- **${name}**: ${def.description}\n`;
        }

        output += `\nUse \`delegate_task\` with one of these agent names to assign work.`;

        return output;
    }
});
