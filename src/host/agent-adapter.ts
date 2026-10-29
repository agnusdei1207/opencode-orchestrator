import type { Plugin } from "@opencode/plugin";
import { AGENTS } from "../agents/definitions.js";
import { AGENT_NAMES } from "../shared/agent/index.js";

/** OpenCode's native delegation tool; its permission key is the tool name. */
const SUBAGENT_TOOL = "subagent";

export function registerAgents(context: Plugin.Context) {
    return context.agent.transform(editor => {
        for (const [name, definition] of Object.entries(AGENTS)) {
            editor.update(name, agent => {
                const primary = name === AGENT_NAMES.COMMANDER;
                agent.description = definition.description;
                agent.system = definition.systemPrompt;
                agent.mode = primary ? "primary" : "subagent";
                agent.hidden = !primary;
                // Planner, Worker and Reviewer are terminal: they report back to
                // Commander instead of spawning their own subagents. The host
                // applies the last matching rule, so this one is appended.
                if (!primary) agent.permissions.push({ action: SUBAGENT_TOOL, resource: "*", effect: "deny" });
            });
        }
    });
}
