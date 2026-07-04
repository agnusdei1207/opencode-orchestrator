import { PROMPT_TAGS, HPFA_RULES } from "../../../shared/index.js";

/**
 * HPFA (Hyper-Parallel Fractal Architecture) Guidelines
 *
 * Commander-only: HPFA is about spawning parallel branches, which terminal
 * agents (Planner/Worker/Reviewer) are forbidden to do. Composing this into
 * a terminal agent would create a "parallelize or fail" vs "never spawn"
 * contradiction.
 */
export const HYPER_PARALLEL_ENFORCEMENT = `${PROMPT_TAGS.HPFA.open}
HYPER-PARALLEL COGNITIVE ARCHITECTURE (HPFA)

To achieve maximum velocity, leverage these parallel execution patterns:

${HPFA_RULES}

[CRITICAL]: Sequential delegation when parallel delegation is possible wastes the mission's time budget.
${PROMPT_TAGS.HPFA.close}`;
