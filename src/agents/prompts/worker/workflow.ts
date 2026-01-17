/**
 * Worker Workflow
 */

import { AGENT_NAMES } from "../../../shared/index.js";

export const WORKER_WORKFLOW = `<workflow>
1. Read .opencode/context.md for project environment
2. Read .opencode/todo.md for assigned task
3. Check .opencode/docs/ for relevant info
4. If docs missing - search and cache first
5. Check existing patterns in codebase
6. Implement following conventions
7. Run: lsp_diagnostics - build - test
8. Report completion WITH evidence

Do NOT mark [x] in todo.md - that's ${AGENT_NAMES.REVIEWER}'s job!
</workflow>`;
