import { PATHS } from "../core/constants.js";

/**
 * System Messages & Templates
 * 
 * Centralized storage for long prompt templates, user messages, and notifications.
 */

export const MISSION_MESSAGES = {
  // Security Messages
  BLOCK_REASON_FORK_BOMB: "Fork bomb detected.",
  BLOCK_REASON_ROOT_DELETE: "Root deletion blocked.",
  SECRET_REDACTED_MSG: "********** [SECRET REDACTED] **********",

  // Sanity Messages
  ANOMALY_INJECT_MSG: (count: number, reason: string, recoveryText: string) =>
    `⚠️ ANOMALY #${count}: ${reason}\n\n${recoveryText}`
} as const;

export const COMPACTION_PROMPT = `<context_checkpoint>
Context usage is high ($USAGE%). Before the next substantial action, preserve the objective, task/session IDs, unfinished work, and useful evidence in ${PATHS.CONTEXT} for an active mission. Keep it concise. OpenCode owns compaction; writing a summary does not prove compaction completed. Respect the user's current instruction.
</context_checkpoint>`;

export const CONTINUE_INSTRUCTION = `<auto_continue>
The active mission has unfinished work. Read ${PATHS.TODO} and the current context before choosing the next useful action. Handle small work directly; delegate only independent bounded scopes when useful. Resolve dependencies first. Check running work through the available task tools instead of duplicating it.
Mark verified TODO leaves [x] and their verified parents status: completed. Keep unresolved work visible and resolve ${PATHS.SYNC_ISSUES}. If a verification checklist exists, every item must pass. Missing evidence is not success.
Respect user pause, abort, and changed instructions. Continue independent authorized work when possible; report missing input, failed checks, and blockers honestly.
</auto_continue>`;

export const STAGNATION_INTERVENTION = `<system_intervention type="stagnation_detected">
Progress has stalled. Inspect the actual task status and available output, identify the blocker, and choose a smaller supported next step. Use existing task tools to observe work; do not infer failure from elapsed time alone or launch duplicate work. If recovery needs missing input, report it and preserve the next action. Respect pause and abort.
</system_intervention>`;

export const CLEANUP_INSTRUCTION = `<system_maintenance type="continuous_hygiene">
Iteration %ITER%: synchronize the active mission's ${PATHS.TODO}, ${PATHS.CONTEXT}, and ${PATHS.SYNC_ISSUES} with verified results. Preserve existing files and document structure; update only relevant sections. Keep useful decisions and unfinished work readable. Do not archive, truncate, or delete unrelated documents as part of mission continuation.
</system_maintenance>`;
