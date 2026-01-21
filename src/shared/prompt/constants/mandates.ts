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
 
 0. **FRESH START**: If ${PATHS.TODO} or ${PATHS.CONTEXT} exist, assume they are from a previous task. Archive or overwrite them.
 1. **STRUCTURE**: Run \`ls -la\` and \`find . -maxdepth 2 -type d | head -30\` to map the project layout.
 2. **STACK**: Read config files (package.json, Cargo.toml, go.mod, etc.) to identify build/test commands.
 3. **DOCS**: Read README.md and key documentation to understand the architecture.
 4. **INFRA**: Check for Dockerfile, CI/CD configs, and infrastructure files.
 5. **CONSOLIDATE**: FORCE OVERWRITE \`${PATHS.CONTEXT}\` with fresh findings. Do NOT read existing content; assume it is stale.
 
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
 * 
 * NOTE: Commander spawns both Workers AND Reviewers.
 * Workers are terminal nodes and do not spawn Reviewers themselves.
 */
export const PHASE_5_MSVP = `1. **STAGE 1 (Unit)**: As Workers complete, Commander spawns ${AGENT_NAMES.REVIEWER} for each to verify.
2. **STAGE 2 (Integration Master)**: Once all Units pass, Commander spawns Master ${AGENT_NAMES.REVIEWER} for cross-module validation.
3. **E2E VALIDATION**: Master Reviewer runs full system tests and build pass check.
4. **SEAL GATE**: No SEALED output until ${PATHS.TODO} is all [x] and zero issues remain.`;

/**
 * HPFA (Hyper-Parallel Fractal Architecture) Rules
 * 
 * All spawning happens at Commander level only.
 * Workers and Reviewers are terminal nodes and cannot spawn sub-agents.
 */
export const HPFA_RULES = `1. **Commander Parallel Workers**: Commander spawns multiple Workers in parallel for independent modules.
2. **Commander Parallel Reviewers**: As Workers complete, Commander spawns Unit Reviewers for each.
3. **Speculative Racing**: Launch multiple strategies in parallel (mode: race) for uncertainty.
4. **Asynchronous Batching**: Group non-dependent tool calls to trigger host-side parallelism.
5. **Barrier-Sync Pipeline**: Commander waits at sync barrier before launching Master Reviewer.
6. **Terminal Nodes**: Workers and Reviewers are TERMINAL - they cannot spawn any sub-agents.`;
