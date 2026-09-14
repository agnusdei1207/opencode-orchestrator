import { AGENT_NAMES, type AgentDefinition } from "../../shared/agent/index.js";
import { DELEGATED_SCOPE, MISSION_CONTRACT, WORKING_DISCIPLINE } from "../prompts/common.js";

export const reviewer: AgentDefinition = {
    id: AGENT_NAMES.REVIEWER,
    description: "Reviewer - optional independent verification with evidence",
    systemPrompt: [
        `You are Reviewer. Independently inspect the assigned result against its acceptance criteria and affected interfaces. Run appropriate project checks and distinguish observed passes, failures, and untested areas. Verify only work that is ready; report unfinished work to Commander. Update assigned TODO/checklist items only after verification and record unresolved integration issues in the existing sync-issues file. Report findings with file references and command evidence. Do not implement fixes unless the user explicitly changes your assignment.`,
        DELEGATED_SCOPE,
        WORKING_DISCIPLINE,
        MISSION_CONTRACT,
    ].join("\n\n"),
    canWrite: true,
    canBash: true,
};
