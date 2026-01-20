/**
 * Commander TODO Format - Hierarchical
 */

import { AGENT_NAMES, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const COMMANDER_TODO_FORMAT = `${PROMPT_TAGS.TODO_FORMAT.open}
## Hierarchical Task Decomposition
Break down the mission into as many levels as needed to ensure clear ownership and parallel execution. Work is only considered DONE when the entire subtree is verified.

### Recursive Completion Rule
- **Leaf Tasks**: Checked \`[x]\` ONLY by ${AGENT_NAMES.REVIEWER} after tool-based verification.
- **Parent Nodes**: Resolved (\`${WORK_STATUS.TODO_STATUS.COMPLETE}\`) ONLY when ALL child tasks are verified (marked \`[x]\`).
- **Mission**: SEALED only when the root of the hierarchy is fully resolved.

## Structure Example
\`\`\`markdown
# Mission: [goal]

## G1: [The Goal] | status: ${WORK_STATUS.TODO_STATUS.IN_PROGRESS}
### P1.1: [Feature Project] | agent:${AGENT_NAMES.PLANNER}
- [ ] T1.1.1: [Atomic Research] | size:S
- [ ] T1.1.2: [Detailed Design] | size:M

### P1.2: [Implementation Block] | agent:${AGENT_NAMES.WORKER} | depends:P1.1
#### P1.2.1: [Sub-module A]
- [ ] T1.2.1.1: [Draft code] | file:src/a.ts | size:M
- [ ] T1.2.1.2: [Tests for A] | file:tests/a.test.ts | size:S

#### P1.2.2: [Sub-module B] | depends:P1.2.1
- [ ] T1.2.2.1: [Draft code] | file:src/b.ts | size:M
- [ ] T1.2.2.2: [Tests for B] | file:tests/b.test.ts | size:S

### P1.3: [Final Quality Pass] | agent:${AGENT_NAMES.REVIEWER} | depends:P1.2
- [ ] T1.3.1: [Visual E2E] | size:M
- [ ] T1.3.2: [Release Build] | size:S
\`\`\`

## Parallel Execution Groups
Tasks with NO shared dependencies can be executed simultaneously:
1. **Parallel Epics/Goals**: G1 and G2 can run together if independent.
2. **Parallel Sub-modules**: P1.2.1 and P1.2.2 can run together if no \`depends:\` link.
3. **Atomic Leaf Tasks**: All \`[ ]\` items under a single Parent can be launched in background sessions.

Create all items with \`[ ]\` - NEVER with \`[x]\`!
Only ${AGENT_NAMES.REVIEWER} marks \`[x]\` after verification!
${PROMPT_TAGS.TODO_FORMAT.close}`;

