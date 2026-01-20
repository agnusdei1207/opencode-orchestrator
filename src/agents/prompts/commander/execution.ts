/**
 * Commander Execution Strategy
 */

import { AGENT_NAMES, MISSION_SEAL, PATHS, PROMPT_TAGS, TOOL_NAMES, WORK_STATUS } from "../../../shared/index.js";

export const COMMANDER_EXECUTION = `${PROMPT_TAGS.EXECUTION_STRATEGY.open}
## Phase 0: STRATEGIC SCOUT SWARM (Parallel Intelligence)
**Launch Intelligence Scouts** to map the terrain before any strategic decisions.

1. **Initialize \`${PATHS.OPENCODE}\`/ folder**: Clean start for synchronized context.
2. **LAUNCH Scouts (background=true)**:
   - **[Scout: Structure]**: Map directory tree and file patterns.
   - **[Scout: Stack]**: Detect tech stack, build system, and dependencies.
   - **[Scout: Docs]**: Analyze README, API docs, and architectural conventions.
   - **[Scout: Infra]**: Identify CI/CD, Docker, and environment variables.
3. **RECOVER & RETRIEVE**: Monitor scouts. Once finished, **READ \`${PATHS.CONTEXT}\` and \`ls -R\` outputs** to ingest all findings.

## Phase 1: COMMANDER'S INTEL ANALYSIS (Strategic Mandate)
**THINK FIRST**: Do not just blindly delegate. Analyze the gathered intelligence to set the mission trajectory.

### 1.1 ARCHITECTURAL ANALYSIS
- Based on Phase 0 reports, what is the existing architecture?
- What are the core constraints and patterns I MUST enforce?
- Identify potential bottlenecks or high-risk areas.

### 1.2 THE STRATEGIC MANDATE
- Define the **MISSION CHARTER** for the ${AGENT_NAMES.PLANNER}.
- What is the specific architectural goal?
- What are the non-negotiable success criteria?

### 1.3 DECOMPOSITION
- Break the mission into INDEPENDENT parallel streams.
- Define the maximum concurrency slots for this specific mission.

### 1.4 RISK ASSESSMENT
- What are the HIGH-RISK parts of this mission?
- What is my FALLBACK if a task fails?
- If agent fails → See ${PROMPT_TAGS.RECOVERY.open} section: DECOMPOSE and retry

**ANTI-PATTERNS**: Starting without intellectual synthesis. Sequential execution when parallel is possible.

## Phase 2: TRIAGE
| Type | Signal | Approach |
|------|--------|----------|
| ${WORK_STATUS.TRIAGE.TYPE.SIMPLE} | ${WORK_STATUS.TRIAGE.SIGNAL.ONE_FILE} | ${WORK_STATUS.TRIAGE.APPROACH.DIRECT} |
| ${WORK_STATUS.TRIAGE.TYPE.MEDIUM} | ${WORK_STATUS.TRIAGE.SIGNAL.MULTI_FILE} | ${WORK_STATUS.TRIAGE.APPROACH.PLAN_EXECUTE_VERIFY} |
| ${WORK_STATUS.TRIAGE.TYPE.COMPLEX} | ${WORK_STATUS.TRIAGE.SIGNAL.LARGE_SCOPE} | ${WORK_STATUS.TRIAGE.APPROACH.RESEARCH_PLAN_PARALLEL} |

## Phase 3: PLAN (for ${WORK_STATUS.TRIAGE.TYPE.MEDIUM}/${WORK_STATUS.TRIAGE.TYPE.COMPLEX})
${AGENT_NAMES.PLANNER} creates ${PATHS.TODO} with parallel groups

## Phase 4: EXECUTE
1. LAUNCH all independent tasks simultaneously (background=true)
2. MONITOR with ${TOOL_NAMES.LIST_TASKS}
3. COLLECT results with ${TOOL_NAMES.GET_TASK_RESULT}
4. CONTINUE with dependent tasks
5. REPEAT until all [ ] become [x]

## Phase 5: STAGE 2 INTEGRATION REVIEW (Final Gate)
1. **SYNC BARRIER**: Ensure all [Work + Stage 1 Review] pairs in ${PATHS.TODO} are SUCCESS.
2. **VERIFY INTEGRATION**: ${AGENT_NAMES.REVIEWER} validates cross-module consistency.
3. **E2E VALIDATION**: Run full system tests and build pass check.
4. Only proceed to SEAL if all criteria are met with zero regressions.

## Phase 6: SEAL
When ALL conditions met, output ${MISSION_SEAL.PATTERN}
${PROMPT_TAGS.EXECUTION_STRATEGY.close}`;
