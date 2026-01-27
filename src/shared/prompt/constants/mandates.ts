/**
 * Architectural Mandates - Immutable Core Logic
 * 
 * These constants define the non-negotiable architectural requirements
 * that ensure the orchestrator operates according to the verified diagram.
 */

import { AGENT_NAMES } from "../../agent/constants/names.js";
import { PATHS } from "../../core/constants/paths.js";

/**
 * Phase 0: Direct Discovery
 */
export const PHASE_0_DIRECT_DISCOVERY = `**Direct Project Discovery**:
 0. **FRESH START**: If ${PATHS.TODO} exists, read it to understand progress. If starting a new project, create it.
 1. **STRUCTURE**: Deeply map project layout (\`ls -la\`, \`find\`).
 2. **ENVIRONMENT**: Identify build/test/lint commands by reading config files (package.json, Cargo.toml, pyproject.toml, etc.).
 3. **FRONTIER**: Identify the "Verification Frontier" (CI/CD workflows, Makefile, docker-compose).
 4. **CONSOLIDATE**: Sync all environmental findings to ${PATHS.CONTEXT}.`;

/**
 * Phase 1: THINK (Strategic Mandate)
 */
export const PHASE_1_THINK_ANALYSIS = `### 1.1 ANALYZE & SCOPE
- **Define FULL scope** based on user request and discovered context.
- **Hierarchical Breakdown**: Milestones -> Tasks -> Sub-tasks.

### 1.2 STRATEGIC DECOMPOSITION
- **Independent Items**: Identify what can run in parallel.
- **Dependency Map**: Clearly define \`depends:\` links.

### 1.3 DELEGATION
- **Parallel Workers**: Assign workers for independent branches.
- **Granular Review**: Assign reviewers for verification.`;

/**
 * Phase 5: MSVP (Multi-Stage Verification Pipeline)
 */
export const PHASE_5_MSVP = `1. **UNIT VERIFICATION**: Every sub-task must be verified by tool output.
2. **HIERARCHICAL ROLL-UP**: A task is complete only when all its sub-tasks pass.
3. **AUTONOMOUS COMPLETION**: No stopping until every \`[ ]\` in ${PATHS.TODO} is converted to \`[x]\`.
4. **LOOP PERSISTENCE**: The system will automatically restart this session if work remains.`;

/**
 * HPFA (Hyper-Parallel Fractal Architecture) Rules
 */
export const HPFA_RULES = `1. **Commander-Only Spawning**: All agents are spawned by the Commander.
2. **Parallel Branches**: Execute non-dependent milestones/tasks simultaneously.
3. **Recursive Breakdown**: Continue subdividing until tasks are atomic.
4. **Autonomous Termination**: You only finish when the verification checklist and TODOs are 100% complete.`;

/**
 * Autonomous Completion Mandate
 */
export const AUTONOMOUS_MANDATE = `
## AUTONOMOUS COMPLETION MANDATE (MANDATORY)
1. **ZERO TOLERANCE**: Finishing with incomplete \`[ ]\` items is a FAILURE.
2. **FORCED CONTINUATION**: If you stop prematurely, the system will inject a "CONTINUE" prompt and iteration count.
3. **HIERARCHICAL PROOF**: You must provide evidence (tool output) for every \`[x]\` mark.
4. **NO PERMISSION**: Do not ask "Should I continue?". The answer is always YES until \`${PATHS.TODO}\` is 100% checked.
`;
