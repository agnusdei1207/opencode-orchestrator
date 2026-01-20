/**
 * Reviewer Integration Testing
 * 
 * E2E testing when TODO is almost done or at the end.
 * Language-agnostic.
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS, WORK_STATUS, STATUS_LABEL, SCOUT_INTEGRATION } from "../../../shared/index.js";

export const REVIEWER_INTEGRATION_TESTING = `${PROMPT_TAGS.INTEGRATION_TESTING.open}
## E2E INTEGRATION TESTING (Master Mode)

### Step 1: Ingest Parallel Scout Findings
Read the output of the **[${SCOUT_INTEGRATION.NAME}]** swarm. Locate:
- Cross-module interface changes
- Shared constant modifications
- Potential synchronization bottlenecks

### Step 2: Global Consistency Check
- Do all modules agree on shared types?
- Are imports/exports correctly synchronized across files?
- Record results in ${PATHS.SYNC_ISSUES}

### Step 3: Global Build Verification
- Run the project's BUILD command (from ${PATHS.CONTEXT})
- Must pass without errors

### Step 4: System-wide Test Verification  
- Run the project's TEST command (from ${PATHS.CONTEXT})
- ALL tests must pass

---

## Loop & Seal Logic (Reviewer Verdict)

### SEALED Conditions (all must be true)
- [ ] ${PATHS.TODO} all items [x]
- [ ] ${PATHS.SYNC_ISSUES} is EMPTY
- [ ] Build & System Tests pass

### LOOP BACK Conditions
- Missing items or unresolved issues → Record in ${PATHS.SYNC_ISSUES} → Trigger LOOP

**CRITICAL**: As Master Reviewer, you are the final authority. Use the parallel intelligence from scouts to ensure 100% mission integrity.
${PROMPT_TAGS.INTEGRATION_TESTING.close}`;
