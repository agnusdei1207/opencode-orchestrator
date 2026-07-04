/**
 * Planner TODO Format - Hierarchical
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const PLANNER_TODO_FORMAT = `${PROMPT_TAGS.PLANNING_FORMAT.open}
OUTPUT TO: ${PATHS.TODO}

## Hierarchical Task Decomposition (Canonical M/T/S Schema)
Break down the complex request into as many levels as needed to achieve atomic work units.
Use the SAME schema all agents share: **M**ilestone → **T**ask → **S**ubtask.

### M — Milestone (Grade 1): \`## M[N]\`
- High-level phase of the mission.
- **COMPLETION RULE**: Satisfied only when ALL child tasks are marked [x].

### T — Task (Grade 2): \`### T[N.N]\` (nest deeper as \`#### T[N.N.N]\` when needed)
- Feature or module grouping. Status: ${WORK_STATUS.TODO_STATUS.PENDING} | [dependencies]

### S — Subtask (Grade 3, leaf): \`- [ ] S[id]: ...\`
- Specific, atomic actions (15-60 min).
- Format: \`- [ ] S[id]: [description] | agent:[Name] | [metadata]\`
- Metadata options: \`depends:[ID]\`, \`file:[path]\`, \`size:[XS/S/M/L]\`

## Template Example
\`\`\`markdown
# Mission: [goal]

## Project Context
...

## M1: [First Milestone] | status: ${WORK_STATUS.TODO_STATUS.PENDING}
### T1.1: [Research & Design] | agent:${AGENT_NAMES.PLANNER}
- [ ] S1.1.1: [Atomic Research] | size:S
- [ ] S1.1.2: [Detailed Design] | size:M

### T1.2: [Implementation Block] | agent:${AGENT_NAMES.WORKER} | depends:T1.1
#### T1.2.1: [Sub-module A]
- [ ] S1.2.1.1: [Draft code] | file:src/a.ts | size:M
- [ ] S1.2.1.2: [Tests for A] | file:tests/a.test.ts | size:S

#### T1.2.2: [Sub-module B] | depends:T1.2.1
- [ ] S1.2.2.1: [Draft code] | file:src/b.ts | size:M
- [ ] S1.2.2.2: [Tests for B] | file:tests/b.test.ts | size:S

### T1.3: [Final Quality Pass] | agent:${AGENT_NAMES.REVIEWER} | depends:T1.2
- [ ] S1.3.1: [Visual E2E] | size:M
- [ ] S1.3.2: [Release Build] | size:S
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

