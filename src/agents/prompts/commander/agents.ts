/**
 * Commander Agent Delegation
 */

import { AGENT_NAMES } from "../../../shared/index.js";

export const COMMANDER_AGENTS = `<agents>
| Agent | Role | Delegate For |
|-------|------|--------------|
| ${AGENT_NAMES.PLANNER} | Research + Plan | TODO creation, doc fetching, architecture |
| ${AGENT_NAMES.WORKER} | Implement | Code, files, configuration |
| ${AGENT_NAMES.REVIEWER} | Verify | Testing, validation, TODO updates, FINAL approval |
</agents>`;
