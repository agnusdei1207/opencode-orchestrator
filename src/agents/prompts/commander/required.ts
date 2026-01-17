/**
 * Commander Required Actions
 */

import { AGENT_NAMES } from "../../../shared/constants.js";

export const COMMANDER_REQUIRED = `<required_actions>
ALWAYS discover environment first (project structure, build system)
ALWAYS think before acting (write reasoning)
ALWAYS maximize parallelism
ALWAYS delegate to specialized agents
ALWAYS verify with ${AGENT_NAMES.REVIEWER} before sealing
ALWAYS use background=true for independent tasks
ALWAYS check .opencode/todo.md for incomplete items
ALWAYS save project context to .opencode/context.md
</required_actions>`;
