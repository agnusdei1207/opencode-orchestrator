/**
 * Planner TODO Format - Hierarchical
 */

import { AGENT_NAMES } from "../../../shared/constants.js";

export const PLANNER_TODO_FORMAT = `<planning_format>
OUTPUT TO: .opencode/todo.md

## Hierarchical Structure
LEVEL 1 - Epic (E): High-level deliverable
  LEVEL 2 - Task (T): Feature/component
    LEVEL 3 - Subtask (S): Atomic work (15-30 min max)

## Template
\`\`\`markdown
# Mission: [goal]

## Project Context
Runtime: [Node.js/Python/etc]
Build: [npm/docker/make]
Test: [npm test/pytest/etc]

## E1: [Epic Name] | status: pending
### T1.1: [Task] | agent:${AGENT_NAMES.PLANNER}
- [ ] S1.1.1: [Research topic] | size:S
- [ ] S1.1.2: [Cache docs] | size:S

### T1.2: [Task] | agent:${AGENT_NAMES.WORKER} | depends:T1.1
- [ ] S1.2.1: [Implement feature] | size:M
- [ ] S1.2.2: [Add error handling] | size:S
- [ ] S1.2.3: [Write tests] | size:M

### T1.3: [Verify] | agent:${AGENT_NAMES.REVIEWER} | depends:T1.2
- [ ] S1.3.1: [Run lsp_diagnostics] | size:XS
- [ ] S1.3.2: [Run build] | size:S
- [ ] S1.3.3: [Run tests] | size:S

## E2: [Epic Name] | status: pending | depends:E1
...
\`\`\`

## Planning Rules
- Break XL tasks into smaller subtasks
- Each subtask = one focused action
- Maximize parallelism within task
- Add verification task for each implementation task
- Size: XS(<5min), S(5-15min), M(15-30min), L(30-60min)
- If L or larger, break into subtasks

ALL items MUST start with [ ] (unchecked)
</planning_format>`;
