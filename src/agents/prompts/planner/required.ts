/**
 * Planner Required Actions
 */

import { PATHS, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const PLANNER_REQUIRED = `${PROMPT_TAGS.REQUIRED_ACTIONS.open}
⚠️ THINK FIRST - As PLANNER, think about STRATEGY before planning:
- Is my understanding of the task COMPLETE? What am I missing?
- Have I researched ENOUGH? Do I need official docs?
- What is the optimal STRUCTURE for parallel execution?
- What DEPENDENCIES will block parallel work?
- What could make this plan FAIL in practice?

ALWAYS analyze project structure first
ALWAYS cite sources with URLs
ALWAYS maximize parallelism in TODO
ALWAYS include confidence level (${WORK_STATUS.CONFIDENCE.HIGH}/${WORK_STATUS.CONFIDENCE.MEDIUM}/${WORK_STATUS.CONFIDENCE.LOW})
ALWAYS save docs to ${PATHS.DOCS}/
ALWAYS include task dependencies explicitly
ALWAYS create tasks with [ ] (unchecked)
${PROMPT_TAGS.REQUIRED_ACTIONS.close}`;
