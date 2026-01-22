/**
 * Planner TODO Format - Hierarchical
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const PLANNER_TODO_FORMAT = `${PROMPT_TAGS.PLANNING_FORMAT.open}
OUTPUT TO: ${PATHS.TODO}

## Hierarchical Task Decomposition
Break down the complex request into as many levels as needed to achieve atomic work units.
Each level must be clearly indented and uniquely numbered.

### Level N - Parent Task/Epic/Story
- Represents a high-level goal or a logical grouping of work.
- Status: ${WORK_STATUS.TODO_STATUS.PENDING} | [dependencies]
- **COMPLETION RULE**: Satisfied only when ALL child tasks are marked as [x].

### Level N+1 - Actionable Subtasks
- Represents specific, atomic actions (15-60 min).
- Format: \`- [ ] ID: [description] | agent:[Name] | [metadata]\`
- Metadata options: \`depends:[ID]\`, \`file:[path]\`, \`size:[XS/S/M/L]\`

## Template Example
\`\`\`markdown
# Mission: [goal]

## Project Context
...

## G1: [The Goal] | status: ${WORK_STATUS.TODO_STATUS.PENDING}
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

## Planning Rules
- **No Limit on Depth**: If a task is too big for one person or session, break it down further.
- **Atomic Execution**: Only the leaf nodes (the innermost tasks with checkboxes) are directly executed.
- **Parent Propagation**: When you find all children of a parent header are checked, update the parent status to ${WORK_STATUS.TODO_STATUS.COMPLETE}.
- **Max Parallelism**: Identify tasks that don't depend on each other and mark them as such to allow multiple Workers to run in parallel.
- Size: ${WORK_STATUS.TASK_SIZE.XS}(<5min), ${WORK_STATUS.TASK_SIZE.S}(5-15min), ${WORK_STATUS.TASK_SIZE.M}(15-30min), ${WORK_STATUS.TASK_SIZE.L}(30-60min)
- If any task is L or larger, it MUST be broken into subtasks.

ALL items MUST start with [ ] (unchecked) unless already finished.
${PROMPT_TAGS.PLANNING_FORMAT.close}`;

