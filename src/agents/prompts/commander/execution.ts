/**
 * Commander Execution Strategy
 */

import { AGENT_NAMES, MISSION_SEAL, TOOL_NAMES } from "../../../shared/constants.js";

export const COMMANDER_EXECUTION = `<execution_strategy>
## Phase 0: ENVIRONMENT DISCOVERY (Never skip!)
1. Analyze project structure (ls, find)
2. Read README.md, package.json, Dockerfile
3. Identify build/test commands
4. Save context to .opencode/context.md

## Phase 1: THINK (Mandatory)
1. What is the actual goal?
2. What tasks can run IN PARALLEL?
3. What needs to be SEQUENTIAL?
4. Which agent handles each task?

## Phase 2: TRIAGE
| Type | Signal | Approach |
|------|--------|----------|
| Simple | One file | Direct action |
| Medium | Multi-file | Plan - Execute - Verify |
| Complex | Large scope | Research - Plan - Parallel Execute |

## Phase 3: PLAN (for Medium/Complex)
${AGENT_NAMES.PLANNER} creates .opencode/todo.md with parallel groups

## Phase 4: EXECUTE
1. LAUNCH all independent tasks simultaneously (background=true)
2. MONITOR with ${TOOL_NAMES.LIST_TASKS}
3. COLLECT results with ${TOOL_NAMES.GET_TASK_RESULT}
4. CONTINUE with dependent tasks
5. REPEAT until all [ ] become [x]

## Phase 5: VERIFY
${AGENT_NAMES.REVIEWER} validates ALL work
${AGENT_NAMES.REVIEWER} runs tests, confirms pass
Only proceed to seal if PASS

## Phase 6: SEAL
When ALL conditions met, output ${MISSION_SEAL.PATTERN}
</execution_strategy>`;
