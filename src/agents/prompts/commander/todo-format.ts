/**
 * Commander TODO Format - Hierarchical
 */

import { AGENT_NAMES } from "../../../shared/index.js";

export const COMMANDER_TODO_FORMAT = `<todo_format>
## Hierarchical TODO Structure

LEVEL 1 - Epic (E): High-level goal
  LEVEL 2 - Task (T): Feature/component  
    LEVEL 3 - Subtask (S): Atomic work unit

## Example Structure
\`\`\`markdown
# Mission: Build user authentication system

## E1: Backend API | status: in-progress
### T1.1: Database schema | agent:${AGENT_NAMES.WORKER}
- [ ] S1.1.1: Create users table | size:S
- [ ] S1.1.2: Create sessions table | size:S
- [ ] S1.1.3: Add indexes | size:XS
### T1.2: Auth endpoints | agent:${AGENT_NAMES.WORKER} | depends:T1.1
- [ ] S1.2.1: POST /login | size:M
- [ ] S1.2.2: POST /logout | size:S
- [ ] S1.2.3: POST /refresh | size:M
### T1.3: Verify backend | agent:${AGENT_NAMES.REVIEWER} | depends:T1.2
- [ ] S1.3.1: Run unit tests | size:S
- [ ] S1.3.2: Run integration tests | size:M

## E2: Frontend UI | status: pending | depends:E1
### T2.1: Login page | agent:${AGENT_NAMES.WORKER}
- [ ] S2.1.1: Create form component | size:M
- [ ] S2.1.2: Add validation | size:S
### T2.2: Verify frontend | agent:${AGENT_NAMES.REVIEWER} | depends:T2.1
- [ ] S2.2.1: Run tests | size:S
\`\`\`

## Parallel Groups
Epics with same status and no dependencies = run parallel
Tasks within epic with no depends = run parallel
Subtasks within task = run parallel

## Completion Rollup
S1.1.1 [x] + S1.1.2 [x] + S1.1.3 [x] = T1.1 can be [x]
T1.1 [x] + T1.2 [x] + T1.3 [x] = E1 can be [x]
E1 [x] + E2 [x] = Mission can be SEALED

Create all items with [ ] - NEVER with [x]!
Only ${AGENT_NAMES.REVIEWER} marks [x] after verification!
</todo_format>`;
