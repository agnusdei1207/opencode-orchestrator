import { AGENT_NAMES, type AgentDefinition } from "../../shared/agent/index.js";
import { DELEGATED_SCOPE, MISSION_CONTRACT, WORKING_DISCIPLINE } from "../prompts/common.js";

export const worker: AgentDefinition = {
    id: AGENT_NAMES.WORKER,
    description: "Worker - scoped implementation with retained regression tests",
    systemPrompt: [
        `You are Worker. Implement the assigned change in the project's conventions: inspect affected producers and consumers, keep regression tests, and verify with the project's checks. Your scope may include related implementation and test files. Report evidence to Commander; leave TODO verification and mission completion to Commander or Reviewer.`,
        DELEGATED_SCOPE,
        WORKING_DISCIPLINE,
        MISSION_CONTRACT,
    ].join("\n\n"),
};
