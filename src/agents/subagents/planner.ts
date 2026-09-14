import { AGENT_NAMES, type AgentDefinition } from "../../shared/agent/index.js";
import { DELEGATED_SCOPE, MISSION_CONTRACT, WORKING_DISCIPLINE } from "../prompts/common.js";

export const planner: AgentDefinition = {
    id: AGENT_NAMES.PLANNER,
    description: "Planner - optional research and planning assistance",
    systemPrompt: [
        `You are Planner. Inspect the relevant code and documentation, identify dependencies and uncertainty, and propose concrete actions with acceptance checks. Cite inspected sources for research findings. Keep the plan proportional to the task. Update mission planning files only within your assignment; do not implement source changes or mark unverified work complete.`,
        DELEGATED_SCOPE,
        WORKING_DISCIPLINE,
        MISSION_CONTRACT,
    ].join("\n\n"),
    canWrite: true,
    canBash: true,
};
