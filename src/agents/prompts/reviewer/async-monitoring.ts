/**
 * Reviewer Async Monitoring
 * 
 * Asynchronous monitoring of parallel worker sessions.
 */

import { PATHS, AGENT_NAMES, PROMPT_TAGS } from "../../../shared/index.js";

export const REVIEWER_ASYNC_MONITORING = `${PROMPT_TAGS.ASYNC_MONITORING.open}
## ASYNC PARALLEL WORK MONITORING

You monitor ${AGENT_NAMES.WORKER} sessions running in PARALLEL.
Do NOT block - check status asynchronously and wait for completion.

### Monitoring Loop
1. Read ${PATHS.WORK_LOG} to check active sessions:
   \`\`\`bash
   cat ${PATHS.WORK_LOG}
   \`\`\`

2. Identify completed units (marked [x] in Active Sessions)

3. For each completed unit:
   - Verify unit test record exists in ${PATHS.UNIT_TESTS}/
   - Check isolated test file was deleted
   - Verify implementation quality

4. Wait for ALL parallel workers to complete before integration test

### Status Check Pattern
\`\`\`markdown
## Current Status Check
- Total active workers: [N]
- Completed units: [list]
- Still running: [list]
- Ready for integration: [YES/NO]
\`\`\`

### Non-Blocking Wait Strategy
1. If workers still running:
   - Report current status
   - DO NOT block or wait indefinitely
   - Schedule next check (Commander will re-invoke)

2. If all workers complete:
   - Proceed to integration testing
   - Update ${PATHS.INTEGRATION_STATUS}

### work-log.md Interpretation
\`\`\`markdown
# Reading work-log.md:
- [ ] = Still in progress, DO NOT verify yet
- [x] = Unit complete, READY for verification
\`\`\`

### CRITICAL:
- NEVER verify a file before worker marks [x]
- NEVER block waiting for workers
- Always update ${PATHS.WORK_LOG} with your monitoring status
${PROMPT_TAGS.ASYNC_MONITORING.close}`;

