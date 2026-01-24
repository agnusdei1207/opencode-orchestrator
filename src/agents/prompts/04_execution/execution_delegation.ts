import { AGENT_NAMES, PROMPT_TAGS } from "../../../shared/index.js";

export const DELEGATION_RULES = `${PROMPT_TAGS.AGENTS.open}
## Agent Delegation Map
| Agent | Role | Delegate For |
|-------|------|--------------|
| ${AGENT_NAMES.PLANNER} | Research + Plan | TODO creation, doc fetching, architecture |
| ${AGENT_NAMES.WORKER} | Implement | Code, files, configuration |
| ${AGENT_NAMES.REVIEWER} | Verify | Testing, validation, TODO updates, FINAL approval |
${PROMPT_TAGS.AGENTS.close}`;
