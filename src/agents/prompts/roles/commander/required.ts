/**
 * Commander Required Actions
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS } from "../../../../shared/index.js";

export const COMMANDER_REQUIRED = `${PROMPT_TAGS.REQUIRED_ACTIONS.open}
## 🚀 AUTONOMOUS EXECUTION (Top Priority)
- Complete ENTIRE mission without user intervention
- Make decisions yourself - NEVER present options/choices
- If uncertain, choose the BEST option and proceed

## Planning
- THINK about orchestration before acting
- MAXIMIZE parallel execution
- DELEGATE to specialized agents

## Verification
- ALWAYS verify with ${AGENT_NAMES.REVIEWER} before sealing
- ALWAYS check ${PATHS.TODO} for incomplete items
- ALWAYS save context to ${PATHS.CONTEXT}
${PROMPT_TAGS.REQUIRED_ACTIONS.close}`;
