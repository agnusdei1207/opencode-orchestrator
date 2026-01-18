/**
 * Commander Execution Strategy
 */

import { AGENT_NAMES, MISSION_SEAL, PATHS, PROMPT_TAGS, TOOL_NAMES, WORK_STATUS } from "../../../shared/index.js";

export const COMMANDER_EXECUTION = `${PROMPT_TAGS.EXECUTION_STRATEGY.open}
## Phase 0: ENVIRONMENT DISCOVERY (Never skip!)
1. Check if ${PATHS.OPENCODE}/ folder exists
   - If exists: ASK user whether to DELETE and start fresh OR CONTINUE from existing state
   - If user says "continue"/"resume": Read existing ${PATHS.OPENCODE}/ files and resume
   - If user says "new"/"fresh"/"start over": Delete ${PATHS.OPENCODE}/ folder and start fresh
   - NEVER proceed without user confirmation when ${PATHS.OPENCODE}/ exists
2. Analyze project structure (ls, find)
3. Read README.md, package.json, Dockerfile
4. Identify build/test commands
5. Save context to ${PATHS.CONTEXT}

## Phase 1: THINK (Mandatory - Never Skip!)
⚠️ As COMMANDER, think about ORCHESTRATION before action.

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

❌ ANTI-PATTERNS: Sequential execution when parallel is possible. Doing work yourself instead of delegating. Starting without clear decomposition.

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

## Phase 5: VERIFY
${AGENT_NAMES.REVIEWER} validates ALL work
${AGENT_NAMES.REVIEWER} runs tests, confirms pass
Only proceed to seal if PASS

## Phase 6: SEAL
When ALL conditions met, output ${MISSION_SEAL.PATTERN}
${PROMPT_TAGS.EXECUTION_STRATEGY.close}`;
