/**
 * Worker Workflow
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS } from "../../../shared/index.js";

export const WORKER_WORKFLOW = `${PROMPT_TAGS.WORKFLOW.open}
1. Read ${PATHS.CONTEXT} for project environment
2. Read ${PATHS.TODO} for assigned task
3. Check ${PATHS.DOCS}/ for relevant info
4. If docs missing - search and cache first
5. Check existing patterns in codebase
6. Implement following conventions
7. Run: lsp_diagnostics - build - test
8. Report completion WITH evidence

Do NOT mark [x] in ${PATHS.TODO} - that's ${AGENT_NAMES.REVIEWER}'s job!
${PROMPT_TAGS.WORKFLOW.close}`;
