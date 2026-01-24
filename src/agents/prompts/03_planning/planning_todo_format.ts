/**
 * Commander TODO Format - Strict Hierarchical
 */

import { AGENT_NAMES, PROMPT_TAGS, TASK_METADATA } from "../../../shared/index.js";

export const COMMANDER_TODO_FORMAT = `${PROMPT_TAGS.TODO_FORMAT.open}
## Strict Hierarchical Task Decomposition
The mission MUST be broken down into a multi-layered hierarchy in \`.opencode/todo.md\`.
This allows for maximum parallel execution and granular verification.

### Hierarchy Levels:
1. **Grade 1: MILRESTONES (M)** - Large, high-level phases of the mission.
2. **Grade 2: TASKS (T)** - Sub-projects/features within a milestone.
3. **Grade 3: SUB-TASKS (S)** - Atomic, verifiable units of work.

### Completion Mandate:
- **Leaf Nodes (Grade 3)**: Marked \`[x]\` ONLY after tool-based verification (build, test, run).
- **Parent Nodes (Tasks/Milestones)**: Considered complete ONLY when ALL children are \`[x]\`.
- **Mission**: Concluded ONLY when the entire hierarchy is \`[x]\`.

## Structure Example
\`\`\`markdown
# Mission: [Overall Goal]

## M1: [First Milestone]
### T1.1: [Feature A] | ${TASK_METADATA.AGENT}:${AGENT_NAMES.WORKER}
- [ ] S1.1.1: [Atomic Step 1] | ${TASK_METADATA.SIZE}:S
- [ ] S1.1.2: [Atomic Step 2] | ${TASK_METADATA.SIZE}:M

### T1.2: [Feature B] | ${TASK_METADATA.DEPENDS}:T1.1
- [ ] S1.2.1: [Atomic Step 1] | ${TASK_METADATA.SIZE}:L
- [ ] S1.2.2: [Verification Test] | ${TASK_METADATA.SIZE}:S

## M2: [Second Milestone] | ${TASK_METADATA.DEPENDS}:M1
...
\`\`\`

## Rules for Autonomous Progression:
1. **NO PLACEHOLDERS**: Every task must have a clear, actionable description.
2. **PARALLELISM**: Identify tasks with no dependencies and execute them using \`delegate_task(background=true)\`.
3. **RECURSIVE REFINEMENT**: If a task is still too abstract, break it down further before executing.
4. **CONTINUOUS VERIFICATION**: Run tests/builds constantly. Do not wait for the end to verify.

⚠️ **AUTONOMOUS LOOP**: The system will automatically RESTART you if any \`[ ]\` remain in \`.opencode/todo.md\`. Do not stop until every box is checked.
${PROMPT_TAGS.TODO_FORMAT.close}`;
