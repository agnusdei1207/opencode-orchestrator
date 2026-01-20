/**
 * Architectural Mandates - Immutable Core Logic
 * 
 * These constants define the non-negotiable architectural requirements
 * that ensure the orchestrator operates according to the verified diagram.
 */

import { AGENT_NAMES, PATHS, TOOL_NAMES } from "../../index.js";

/**
 * Phase 0: Discovery Swarm Mandate
 * Force parallel execution of scouts to maximize velocity.
 */
export const PHASE_0_SCOUT_SWARM = `**Mandatory Parallel Initialization**: DO NOT run discovery tools (ls, grep, find) yourself. Your job is to ORCHESTRATE and synthesize results. 

1. **LAUNCH Parallel Scouts**: In your VERY FIRST response, you must output ALL of the following \`${TOOL_NAMES.DELEGATE_TASK}\` calls simultaneously (background: true) for:
   - **[Scout: Structure]**: Map the project tree and locate src/tests/docs.
   - **[Scout: Stack]**: Identify language, frameworks, and build/test commands.
   - **[Scout: Docs]**: Digest README.md and core system architecture.
   - **[Scout: Infra]**: Detect CI/CD, Docker, and environment configuration.
2. **PARALLEL SYNC**: Use \`${TOOL_NAMES.LIST_TASKS}\` to monitor progress. 
3. **ONE-PASS INGESTION**: Once all scouts show DONE, use \`${TOOL_NAMES.GET_TASK_RESULT}\` for ALL scouts in a single turn to consolidate findings into \`${PATHS.CONTEXT}\`.

[CRITICAL]: Sequential execution (running tools yourself) is a mission failure. Launch the swarm NOW.`;

/**
 * Phase 1: THINK (Strategic Mandate)
 */
export const PHASE_1_THINK_ANALYSIS = `### 1.1 MISSION SCOPE
- What is the FULL scope? What are the success criteria?
- What does the user REALLY want?

### 1.2 DECOMPOSITION
- Break into INDEPENDENT sub-tasks.
- Identify sequential dependencies vs parallel opportunities.

### 1.3 DELEGATION
- Choose best agent for each task (${AGENT_NAMES.PLANNER}/${AGENT_NAMES.WORKER}/${AGENT_NAMES.REVIEWER}).
- Provide focused context for each.

### 1.4 RISK ASSESSMENT
- Identify high-risk parts and fallback plans.
- If agent fails → See RECOVERY section.`;

/**
 * Phase 5: MSVP (Multi-Stage Verification Pipeline)
 */
export const PHASE_5_MSVP = `1. **STAGE 1 (Unit)**: Workers MUST trigger ${AGENT_NAMES.REVIEWER} for unit verification immediately upon completion.
2. **STAGE 2 (Integration)**: ${AGENT_NAMES.REVIEWER} validates cross-module consistency.
3. **E2E VALIDATION**: Run full system tests and build pass check.
4. **SEAL GATE**: No SEALED output until ${PATHS.TODO} is all [x] and zero issues remain.`;

/**
 * HPFA (Hyper-Parallel Fractal Architecture) Rules
 */
export const HPFA_RULES = `1. **Fractal Spawning**: Workers spawn sub-workers for complex files/modules.
2. **Speculative Racing**: Launch multiple strategies in parallel (mode: race) for uncertainty.
3. **Asynchronous Batching**: Group non-dependent tool calls to trigger host-side parallelism.
4. **Barrier-Sync Pipeline**: Reviewers start Unit Review (Stage 1) while other workers still run.
5. **Real-time Brain Sync**: Parallel sessions share public interfaces via shared task logs.`;
