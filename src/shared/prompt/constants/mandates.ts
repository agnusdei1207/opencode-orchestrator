/**
 * Architectural Mandates - Immutable Core Logic
 * 
 * These constants define the non-negotiable architectural requirements
 * that ensure the orchestrator operates according to the verified diagram.
 * 
 * NOTE: Direct reading is preferred over parallel scouts to reduce token costs.
 */

import { AGENT_NAMES } from "../../agent/constants/names.js";
import { PATHS } from "../../core/constants/paths.js";

/**
 * Phase 0: Direct Discovery
 * Read directly - no parallel scout overhead, saves tokens and time.
 */
export const PHASE_0_DIRECT_DISCOVERY = `**Direct Project Discovery**: Read the project directly to understand it.

1. **STRUCTURE**: Run \`ls -la\` and \`find . -maxdepth 2 -type d | head -30\` to map the project layout.
2. **STACK**: Read config files (package.json, Cargo.toml, go.mod, etc.) to identify build/test commands.
3. **DOCS**: Read README.md and key documentation to understand the architecture.
4. **INFRA**: Check for Dockerfile, CI/CD configs, and infrastructure files.
5. **CONSOLIDATE**: Save findings to \`${PATHS.CONTEXT}\`.

[EFFICIENT]: Direct reading is faster and cheaper than delegating to parallel scouts.`;

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
2. **STAGE 2 (Integration Master)**: The Master ${AGENT_NAMES.REVIEWER} directly reads all modified files and validates cross-module consistency.
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
