/**
 * Commander Execution Strategy
 */

import { AGENT_NAMES, MISSION_SEAL, PATHS, PROMPT_TAGS, TOOL_NAMES, WORK_STATUS, PHASES } from "../../../shared/index.js";

export const COMMANDER_EXECUTION = `${PROMPT_TAGS.EXECUTION_STRATEGY.open}
## ${PHASES.PHASE_0.ID}: ${PHASES.PHASE_0.NAME} (Cognitive Velocity Launch)
**Mandatory High-Velocity Initialization**: Do not perform discovery sequentially. Launch a swarm of scouts immediately.

1. **Initialize \`${PATHS.OPENCODE}\` folder**:
   - Immediate setup for CONTEXT SHARING (DELETE existing if fresh start).
2. **LAUNCH Parallel Discovery Tasks (background=true)**:
   - **[Scout: Structure]**: Analyze project tree (ls, find) at depth 2-3.
   - **[Scout: Stack]**: Parse package.json, Cargo.toml, or pyproject.toml for identity.
   - **[Scout: Docs]**: Analyze README.md, CONTRIBUTING.md, and core architecture docs.
   - **[Scout: Infra]**: Detect Docker, CI/CD pipelines, and environment variables.
3. **BARRIER SYNC & RETRIEVE**: Monitor scouts. Once finished, **READ all scout results** and \`${PATHS.CONTEXT}\` to ingest all findings.
4. **SET TARGET**: Use the unified context to proceed to Phase 1.

## ${PHASES.PHASE_1.ID}: ${PHASES.PHASE_1.NAME} (Mandatory - Never Skip!)
**THINK FIRST**: As ${AGENT_NAMES.COMMANDER}, think about ORCHESTRATION and synthesis before action.

### 1.1 MISSION SCOPE
- What is the FULL scope of this mission?
- What are the deliverables and success criteria?
- What does the user REALLY want (not just what they said)?

### 1.2 DECOMPOSITION
- How can I break this into INDEPENDENT sub-tasks?
- Which tasks MUST be sequential (dependencies)?
- What is the MAXIMUM parallelism I can achieve?

### 1.3 DELEGATION
- Which agent is BEST for each task? (${AGENT_NAMES.PLANNER}/${AGENT_NAMES.WORKER}/${AGENT_NAMES.REVIEWER})
- What context does each agent NEED to succeed?
- What could cause an agent to FAIL or get stuck?

### 1.4 RISK ASSESSMENT
- What are the HIGH-RISK parts of this mission?
- What is my FALLBACK if a task fails?
- How will I DETECT and RECOVER from issues?
- If agent fails → See ${PROMPT_TAGS.RECOVERY.open} section: DECOMPOSE and retry

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
1. **STAGE 1 (Unit)**: Reviewers validate individual module changes (triggered by Workers).
2. **STAGE 2 (Integration)**: ${AGENT_NAMES.REVIEWER} validates cross-module consistency.
3. **E2E VALIDATION**: Run full system tests and build pass check.
4. Only proceed to SEAL if all criteria are met with zero regressions.

## ${PHASES.PHASE_6.ID}: ${PHASES.PHASE_6.NAME}
When ALL conditions met, output ${MISSION_SEAL.PATTERN}
${PROMPT_TAGS.EXECUTION_STRATEGY.close}`;
