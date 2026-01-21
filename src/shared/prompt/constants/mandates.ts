/**
 * Architectural Mandates - Immutable Core Logic
 * 
 *
 * These constants define the non-negotiable architectural requirements
 * that ensure the orchestrator operates according to the verified diagram.
 */

import { AGENT_NAMES } from "../../agent/constants/names.js";
import { PATHS } from "../../core/constants/paths.js";
import { TOOL_NAMES } from "../../tool/constants/tool-names.js";
import {
   SCOUT_STRUCTURE,
   SCOUT_STACK,
   SCOUT_DOCS,
   SCOUT_INFRA,
   SCOUT_INTEGRATION
} from "./scouts.js";

/**
 * Phase 0: Discovery Swarm Mandate
 * Force parallel execution of scouts to maximize velocity.
 */
export const PHASE_0_SCOUT_SWARM = `**Mandatory Parallel Initialization**: DO NOT run discovery tools (ls, grep, find) yourself. Your job is to ORCHESTRATE and synthesize results.

1. **LAUNCH Parallel Scouts**: In your VERY FIRST response, you must output ALL of the following \`${TOOL_NAMES.DELEGATE_TASK}\` calls simultaneously (background: true) for:
   - **[${SCOUT_STRUCTURE.NAME}]**: ${SCOUT_STRUCTURE.PROMPT} (To ${AGENT_NAMES.PLANNER})
   - **[${SCOUT_STACK.NAME}]**: ${SCOUT_STACK.PROMPT} (To ${AGENT_NAMES.PLANNER})
   - **[${SCOUT_DOCS.NAME}]**: ${SCOUT_DOCS.PROMPT} (To ${AGENT_NAMES.PLANNER})
   - **[${SCOUT_INFRA.NAME}]**: ${SCOUT_INFRA.PROMPT} (To ${AGENT_NAMES.PLANNER})
2. **PARALLEL SYNC**: Use \`${TOOL_NAMES.LIST_TASKS}\` to monitor progress. 
3. **ONE-PASS INGESTION**: Once all scouts show DONE, use \`${TOOL_NAMES.GET_TASK_RESULT}\` for ALL scouts in a single turn to consolidate findings into \`${PATHS.CONTEXT}\`.

[CRITICAL]: Sequential execution (running tools yourself) is a mission failure. Launch the swarm NOW.`;

/**
 * Phase 1: THINK (Strategic Mandate)
 */
export const PHASE_1_THINK_ANALYSIS = `### 1.1 ANALYZE & SCOPE (INPUT)
- **Review consolidated ${PATHS.CONTEXT} from Phase 0.**
- Map discovered files to the user's request.
- **Define Scope:** What is the FULL scope? What does the user REALLY want?

### 1.2 STRATEGIC DECOMPOSITION (THINKING)
- **Mental Model:** How do identified files interact?
- **Breakdown:** Break into INDEPENDENT sub-tasks (sequential vs parallel).
- **Plan Structure:** How should ${AGENT_NAMES.PLANNER} structure the ${PATHS.TODO}?

### 1.3 DELEGATION & DIRECTIVES (OUTPUT)
- **Synthesize Instructions:** Create clear directives for ${AGENT_NAMES.PLANNER}.
- **Pass Context:** Ensure specific file paths and tech stack details are passed.
- **Assign Roles:** Verify correct agent assignment (${AGENT_NAMES.WORKER}/${AGENT_NAMES.REVIEWER}).

### 1.4 RISK ASSESSMENT
- Identify high-risk parts and fallback plans.
- If agent fails → See RECOVERY section.`;

/**
 * Phase 5: MSVP (Multi-Stage Verification Pipeline)
 */
export const PHASE_5_MSVP = `1. **STAGE 1 (Unit)**: Workers MUST trigger ${AGENT_NAMES.REVIEWER} for unit verification immediately upon completion.
2. **PARALLEL DISCOVERY**: Before Stage 2, launch a swarm of scouts (background: true) using **[${SCOUT_INTEGRATION.NAME}]**: ${SCOUT_INTEGRATION.PROMPT} (To ${AGENT_NAMES.PLANNER}).
3. **STAGE 2 (Integration Master)**: The Master ${AGENT_NAMES.REVIEWER} ingests all scout findings to validate cross-module consistency.
4. **E2E VALIDATION**: Run full system tests and build pass check.
5. **SEAL GATE**: No SEALED output until ${PATHS.TODO} is all [x] and zero issues remain.`;

/**
 * HPFA (Hyper-Parallel Fractal Architecture) Rules
 */
export const HPFA_RULES = `1. **Fractal Spawning**: Workers spawn sub-workers for complex files/modules.
2. **Speculative Racing**: Launch multiple strategies in parallel (mode: race) for uncertainty.
3. **Asynchronous Batching**: Group non-dependent tool calls to trigger host-side parallelism.
4. **Barrier-Sync Pipeline**: Reviewers start Unit Review (Stage 1) while other workers still run.
5. **Real-time Brain Sync**: Parallel sessions share public interfaces via shared task logs.`;
