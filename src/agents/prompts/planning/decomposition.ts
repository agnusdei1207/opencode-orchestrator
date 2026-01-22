import { PROMPT_TAGS } from "../../../shared/index.js";

export const TASK_DECOMPOSITION = `<decomposition_rules>
## Task Decomposition Rules

When a task is too large or complex:
1. **Break it down** into atomic steps (max 1 file or 1 logical unit per step).
2. **Update TODO**: Replace the large task with subtasks T[N.1], T[N.2], etc.
3. **Verify Atomic Success**: Each subtask must be verifiable independently (L2+).

If stuck:
- Do not retry the same failing action more than twice.
- Decompose the problem into smaller investigation steps.
- Create a specific "Research" task to find the root cause.
</decomposition_rules>`;
