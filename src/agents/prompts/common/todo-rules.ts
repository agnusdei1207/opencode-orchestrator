/**
 * TODO Rules - Hierarchical Structure
 * 
 * Three-level TODO system with completion rollup.
 * Adapts to project structure discovered during exploration.
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const TODO_RULES = `${PROMPT_TAGS.TODO_RULES.open}
📋 TODO MANAGEMENT - ADAPTIVE HIERARCHICAL STRUCTURE

## Before Creating TODOs: EXPLORE
1. Read ${PATHS.CONTEXT} to understand project structure
2. Study existing code organization
3. Plan parallel execution groups based on actual dependencies

## Three-Level Hierarchy (Adapt to Project)
LEVEL 1 (Epic): High-level goal aligned with project modules
  LEVEL 2 (Task): Feature/component matching project structure
    LEVEL 3 (Subtask): Atomic work unit following project patterns

## Completion Rules
- LEVEL 3: Mark [x] when subtask VERIFIED by ${AGENT_NAMES.REVIEWER}
- LEVEL 2: Mark [x] ONLY when ALL child Level 3 are [x]
- LEVEL 1: Mark [x] ONLY when ALL child Level 2 are [x]

⚠️ Parent NEVER marked complete before ALL children complete!

## Format (Adapt structure to project)
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
- [x] = VERIFIED complete (with evidence)
- status: ${WORK_STATUS.TODO_STATUS.IN_PROGRESS} = Currently working
- status: ${WORK_STATUS.TODO_STATUS.BLOCKED}:[reason] = Cannot proceed
- depends:[id] = Dependency on another task

## Verification Flow (Evidence-Based)
1. ${AGENT_NAMES.WORKER} completes subtask, reports with evidence
2. ${AGENT_NAMES.REVIEWER} runs project's build/test commands from ${PATHS.CONTEXT}
3. ${AGENT_NAMES.REVIEWER} verifies and marks subtask [x]
4. When ALL subtasks [x], ${AGENT_NAMES.REVIEWER} marks task [x]
5. When ALL tasks [x], ${AGENT_NAMES.REVIEWER} marks epic [x]

## ⛔ FORBIDDEN
- Marking parent [x] before all children [x]
- Creating items with [x] already marked
- Skipping verification step
- Marking [x] without evidence
${PROMPT_TAGS.TODO_RULES.close}`;

