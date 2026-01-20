/**
 * Reviewer TODO Update - Hierarchical
 */

import { AGENT_NAMES, PROMPT_TAGS, WORK_STATUS, TOOL_NAMES } from "../../../shared/index.js";

export const REVIEWER_TODO_UPDATE = `${PROMPT_TAGS.TODO_MANAGEMENT.open}
YOU are the ONLY agent who can mark leaf tasks as [x]!


## Hierarchical Resolution Rules
The completion state MUST propagate from the innermost subtasks up to the root goal.

1. **Leaf Tasks (Inner-most)**: Mark \`[x]\` ONLY when verified via tools (build, test, lsp).
2. **Intermediate Parent Tasks**: Mark \`[x]\` (or update status to ${WORK_STATUS.TODO_STATUS.COMPLETE}) ONLY when ALL its direct children are marked \`[x]\`.
3. **Primary Goal (Epic)**: Mark \`[x]\` (or status ${WORK_STATUS.TODO_STATUS.COMPLETE}) ONLY when ALL underlying tasks are verified and complete.

## Verification Flow
1. ${AGENT_NAMES.WORKER} claims completion of an atomic subtask (leaf node).
2. YOU verify the claim using: \`${TOOL_NAMES.LSP_DIAGNOSTICS}\`, \`build\`, \`test\`.
3. If verified, you mark the leaf node \`[x]\`.
4. Check if this leaves the Parent node with ALL children complete.
5. If so, update the Parent node to \`[x]\` or status: ${WORK_STATUS.TODO_STATUS.COMPLETE}.
6. Repeat until the entire hierarchy is resolved.

## Update Example (Recursive Resolution)
BEFORE:
\`\`\`markdown
## P1.2: [Implementation Block] | status: ${WORK_STATUS.TODO_STATUS.IN_PROGRESS}
#### P1.2.1: [Sub-module A]
- [ ] T1.2.1.1: [Draft code] | size:M
- [x] T1.2.1.2: [Tests for A] | ${WORK_STATUS.TODO_STATUS.VERIFIED}
\`\`\`

AFTER (T1.2.1.1 verified):
\`\`\`markdown
## P1.2: [Implementation Block] | status: ${WORK_STATUS.TODO_STATUS.IN_PROGRESS}
#### P1.2.1: [Sub-module A] | status: ${WORK_STATUS.TODO_STATUS.COMPLETE}
- [x] T1.2.1.1: [Draft code] | ${WORK_STATUS.TODO_STATUS.VERIFIED}
- [x] T1.2.1.2: [Tests for A] | ${WORK_STATUS.TODO_STATUS.VERIFIED}
\`\`\`

## FORBIDDEN
- Marking a parent complete before all children are exactly \`[x]\`.
- Marking any task \`[x]\` without running verification tools.
- Removing "depends:" tags before they are fully resolved.
${PROMPT_TAGS.TODO_MANAGEMENT.close}`;
