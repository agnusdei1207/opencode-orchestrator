/**
 * TODO Rules - Hierarchical Structure
 * 
 * Three-level TODO system with completion rollup.
 */

import { AGENT_NAMES, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const TODO_RULES = `${PROMPT_TAGS.TODO_RULES.open}
TODO MANAGEMENT - HIERARCHICAL STRUCTURE

## Three-Level Hierarchy
LEVEL 1 (Epic): High-level goal
  LEVEL 2 (Task): Mid-level feature/component
    LEVEL 3 (Subtask): Atomic work unit

## Completion Rules
- LEVEL 3: Mark [x] when subtask verified
- LEVEL 2: Mark [x] ONLY when ALL child Level 3 are [x]
- LEVEL 1: Mark [x] ONLY when ALL child Level 2 are [x]

Parent NEVER marked complete before ALL children complete!

## Format
\`\`\`markdown
# Mission: [goal]

## E1: [Epic Name] | status: ${WORK_STATUS.TODO_STATUS.IN_PROGRESS}
### T1.1: [Task Name] | agent:${AGENT_NAMES.WORKER}
- [ ] S1.1.1: [subtask] | size:S
- [ ] S1.1.2: [subtask] | size:S
### T1.2: [Task Name] | agent:${AGENT_NAMES.WORKER} | depends:T1.1
- [ ] S1.2.1: [subtask] | size:M

## E2: [Epic Name] | status: ${WORK_STATUS.TODO_STATUS.BLOCKED}
### T2.1: [Task Name] | agent:${AGENT_NAMES.PLANNER}
- [ ] S2.1.1: [subtask] | size:S
\`\`\`

## Status Indicators
- [ ] = Not started
- [x] = VERIFIED complete
- status: ${WORK_STATUS.TODO_STATUS.IN_PROGRESS} = Currently working
- status: ${WORK_STATUS.TODO_STATUS.BLOCKED}:[reason] = Cannot proceed
- depends:[id] = Dependency

## Verification Flow
1. ${AGENT_NAMES.WORKER} completes subtask, reports done
2. ${AGENT_NAMES.REVIEWER} verifies, marks subtask [x]
3. When ALL subtasks [x], ${AGENT_NAMES.REVIEWER} marks task [x]
4. When ALL tasks [x], ${AGENT_NAMES.REVIEWER} marks epic [x]

FORBIDDEN:
- Marking parent [x] before all children [x]
- Creating items with [x] already marked
- Skipping verification step
${PROMPT_TAGS.TODO_RULES.close}`;
