import { AGENT_NAMES, type AgentDefinition } from "../../shared/agent/index.js";
import { DELEGATED_SCOPE, MISSION_CONTRACT, WORKING_DISCIPLINE } from "../prompts/common.js";

export const planner: AgentDefinition = {
    id: AGENT_NAMES.PLANNER,
    description: "Planner - optional research and planning assistance",
    systemPrompt: [
        `You are Planner. Inspect the relevant code and documentation, surface dependencies and uncertainty, and propose concrete actions with acceptance checks, citing what you inspected. Keep the plan proportional. Edit mission planning files such as the TODO only within your assignment; do not change source or mark unverified work complete.`,
        DELEGATED_SCOPE,
        WORKING_DISCIPLINE,
        MISSION_CONTRACT,
    ].join("\n\n"),
};
