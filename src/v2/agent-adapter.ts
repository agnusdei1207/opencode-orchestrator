import type { Plugin } from "@opencode/plugin";
import { AGENTS } from "../agents/definitions.js";
import { AGENT_NAMES } from "../shared/agent/index.js";

export function registerV2Agents(context: Plugin.Context) {
    return context.agent.transform(editor => {
        for (const [name, definition] of Object.entries(AGENTS)) {
            editor.update(name, agent => {
                const primary = name === AGENT_NAMES.COMMANDER;
                agent.description = definition.description;
                agent.system = definition.systemPrompt;
                agent.mode = primary ? "primary" : "subagent";
                agent.hidden = !primary;
            });
        }
    });
}
