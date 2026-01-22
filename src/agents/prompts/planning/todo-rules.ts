/**
 * TODO Rules - Hierarchical Structure
 * 
 * Three-level TODO system with completion rollup.
 * Adapts to project structure discovered during exploration.
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const TODO_RULES = `${PROMPT_TAGS.TODO_RULES.open}
TODO MANAGEMENT - ADAPTIVE HIERARCHICAL STRUCTURE

## Before Creating TODOs: EXPLORE
1. Read ${PATHS.CONTEXT} to understand project structure
2. Study existing code organization
3. Plan parallel execution groups based on actual dependencies

## Recursive Hierarchy (Adapt to Project)
Break down work into as many nested levels as necessary.
- **Root**: The main Mission/Goal.
- **Branch**: Parent tasks representing modules, features, or epics.
- **Leaf**: Atomic work units (15-60 min) with checkboxes \`[ ]\`.

## Completion & Propagation Rules
- **Leaf Tasks**: Mark \`[x]\` ONLY when verified by ${AGENT_NAMES.REVIEWER} with evidence (build/test/lsp).
- **Parent Tasks**: Automatically considered ${WORK_STATUS.TODO_STATUS.COMPLETE} ONLY when ALL their direct children (subtasks or sub-groups) are marked \`[x]\` or \`COMPLETE\`.
- **Mission**: Fully resolved ONLY when the entire hierarchy is marked \`[x]\`.

[CRITICAL]: Parent NEVER marked complete before ALL children are verified!

## Format (Nested Indentation)
\`\`\`markdown
# Mission: [goal]

## G1: [Goal Name] | status: ${WORK_STATUS.TODO_STATUS.IN_PROGRESS}
### P1.1: [Project Name] | agent:${AGENT_NAMES.WORKER}
- [ ] T1.1.1: [subtask] | size:S
- [ ] T1.1.2: [subtask] | size:S

#### P1.1.3: [Sub-component]
- [ ] T1.1.3.1: [Nested task] | size:M

### P1.2: [Review Block] | agent:${AGENT_NAMES.REVIEWER} | depends:P1.1
- [ ] T1.2.1: [Final Verification] | size:S
\`\`\`

## Status Indicators
- \`[ ]\` = Not started
- \`[x]\` = VERIFIED complete (by ${AGENT_NAMES.REVIEWER})
- \`status: ${WORK_STATUS.TODO_STATUS.IN_PROGRESS}\` = Currently working
- \`status: ${WORK_STATUS.TODO_STATUS.BLOCKED}:[reason]\` = Cannot proceed
- \`status: ${WORK_STATUS.TODO_STATUS.COMPLETE}\` = All children verified
- \`depends:[id]\` = Dependency on another task

## Verification Flow (Evidence-Based)
1. ${AGENT_NAMES.WORKER} completes subtask, reports with evidence.
2. ${AGENT_NAMES.REVIEWER} runs project's build/test commands from ${PATHS.CONTEXT}.
3. ${AGENT_NAMES.REVIEWER} verifies and marks leaf subtask \`[x]\`.
4. ${AGENT_NAMES.REVIEWER} propagates completion to Parent if ALL sibling tasks are also \`[x]\`.

## FORBIDDEN
- Marking parent \`[x]\` or \`${WORK_STATUS.TODO_STATUS.COMPLETE}\` before all children \`[x]\`.
- Creating items with \`[x]\` already marked.
- Marking \`[x]\` without tool-based evidence.
${PROMPT_TAGS.TODO_RULES.close}`;



