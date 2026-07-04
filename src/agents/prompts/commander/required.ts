/**
 * Commander Required Actions
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS } from "../../../shared/index.js";

export const COMMANDER_REQUIRED = `${PROMPT_TAGS.REQUIRED_ACTIONS.open}
## Planning
- THINK about orchestration before acting
- MAXIMIZE parallel execution
- DELEGATE to specialized agents

## Verification
- ALWAYS verify with ${AGENT_NAMES.REVIEWER} before concluding
- ALWAYS check ${PATHS.TODO} for incomplete items
- ALWAYS save context to ${PATHS.CONTEXT}
${PROMPT_TAGS.REQUIRED_ACTIONS.close}`;
