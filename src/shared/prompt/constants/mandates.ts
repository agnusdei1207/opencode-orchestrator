/**
 * Architectural Mandates - Immutable Core Logic
 * 
 * These constants define the non-negotiable architectural requirements
 * that ensure the orchestrator operates according to the verified diagram.
 */

import { AGENT_NAMES, PATHS, TOOL_NAMES } from "../../index.js";

export const MANDATES = {
    /**
     * Phase 0: Discovery Swarm Mandate
     */
    PHASE_0_SCOUT_SWARM: `**Mandatory Parallel Initialization**: DO NOT run discovery tools (ls, grep, find) yourself. Your job is to ORCHESTRATE. 

1. **LAUNCH Parallel Scouts**: In your VERY FIRST response, output ALL '${TOOL_NAMES.DELEGATE_TASK}' calls (background: true) for:
   - [Scout: Structure]: Map project tree via ${AGENT_NAMES.PLANNER}.
   - [Scout: Stack]: Identify tech stack via ${AGENT_NAMES.PLANNER}.
   - [Scout: Docs]: Digest README and architecture via ${AGENT_NAMES.PLANNER}.
   - [Scout: Infra]: Detect CI/CD and Docker via ${AGENT_NAMES.PLANNER}.
2. **BARRIER SYNC**: READ consolidated results from ${PATHS.CONTEXT} and scout sessions only AFTER all show'DONE'.`,

    /**
     * Phase 1: THINK (Strategic Mandate)
     */
    PHASE_1_THINK_ANALYSIS: `### 1.1 MISSION SCOPE
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
- If agent fails → See RECOVERY section.`,

    /**
     * Phase 5: MSVP (Multi-Stage Verification Pipeline)
     */
    PHASE_5_MSVP: `1. **STAGE 1 (Unit)**: Workers MUST trigger ${AGENT_NAMES.REVIEWER} for unit verification immediately upon completion.
2. **STAGE 2 (Integration)**: ${AGENT_NAMES.REVIEWER} validates cross-module consistency.
3. **E2E VALIDATION**: Run full system tests and build pass check.
4. **SEAL GATE**: No SEALED output until ${PATHS.TODO} is all [x] and zero issues remain.`,

    /**
     * HPFA (Hyper-Parallel Fractal Architecture) Rules
     */
    HPFA_RULES: `1. **Fractal Spawning**: Workers spawn sub-workers for complex files/modules.
2. **Speculative Racing**: Launch multiple strategies in parallel (mode: race) for uncertainty.
3. **Asynchronous Batching**: Group non-dependent tool calls to trigger host-side parallelism.
4. **Barrier-Sync Pipeline**: Reviewers start Unit Review (Stage 1) while other workers still run.
5. **Real-time Brain Sync**: Parallel sessions share public interfaces via shared task logs.`,
} as const;
