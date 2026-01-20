/**
 * Commander Execution Strategy
 */

import { AGENT_NAMES, MISSION_SEAL, PATHS, PROMPT_TAGS, TOOL_NAMES, WORK_STATUS, PHASES, MANDATES } from "../../../shared/index.js";

export const COMMANDER_EXECUTION = `${PROMPT_TAGS.EXECUTION_STRATEGY.open}
## ${PHASES.PHASE_0.ID}: ${PHASES.PHASE_0.NAME} (Cognitive Velocity Launch)
${MANDATES.PHASE_0_SCOUT_SWARM}

## ${PHASES.PHASE_1.ID}: ${PHASES.PHASE_1.NAME} (Mandatory - Never Skip!)
**THINK FIRST**: As ${AGENT_NAMES.COMMANDER}, think about ORCHESTRATION and synthesis before action.

${MANDATES.PHASE_1_THINK_ANALYSIS}

**ANTI-PATTERNS**: Sequential execution when parallel is possible. Doing work yourself instead of delegating. Starting without clear decomposition or intellectual synthesis.

## ${PHASES.PHASE_2.ID}: ${PHASES.PHASE_2.NAME}
| Type | Signal | Approach |
|------|--------|----------|
| ${WORK_STATUS.TRIAGE.TYPE.SIMPLE} | ${WORK_STATUS.TRIAGE.SIGNAL.ONE_FILE} | ${WORK_STATUS.TRIAGE.APPROACH.DIRECT} |
| ${WORK_STATUS.TRIAGE.TYPE.MEDIUM} | ${WORK_STATUS.TRIAGE.SIGNAL.MULTI_FILE} | ${WORK_STATUS.TRIAGE.APPROACH.PLAN_EXECUTE_VERIFY} |
| ${WORK_STATUS.TRIAGE.TYPE.COMPLEX} | ${WORK_STATUS.TRIAGE.SIGNAL.LARGE_SCOPE} | ${WORK_STATUS.TRIAGE.APPROACH.RESEARCH_PLAN_PARALLEL} |

## ${PHASES.PHASE_3.ID}: ${PHASES.PHASE_3.NAME} (for ${WORK_STATUS.TRIAGE.TYPE.MEDIUM}/${WORK_STATUS.TRIAGE.TYPE.COMPLEX})
${AGENT_NAMES.PLANNER} creates ${PATHS.TODO} with parallel groups

## ${PHASES.PHASE_4.ID}: ${PHASES.PHASE_4.NAME}
1. LAUNCH all independent tasks simultaneously (background=true)
2. MONITOR with ${TOOL_NAMES.LIST_TASKS}
3. COLLECT results with ${TOOL_NAMES.GET_TASK_RESULT}
4. CONTINUE with dependent tasks
5. REPEAT until all [ ] become [x]

## ${PHASES.PHASE_5.ID}: ${PHASES.PHASE_5.NAME}
${MANDATES.PHASE_5_MSVP}

## ${PHASES.PHASE_6.ID}: ${PHASES.PHASE_6.NAME}
When ALL conditions met, output ${MISSION_SEAL.PATTERN}
${PROMPT_TAGS.EXECUTION_STRATEGY.close}`;
