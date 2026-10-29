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
Context usage is high ($USAGE%). For an active mission, save the objective, task/session IDs, unfinished work, and key evidence to ${PATHS.CONTEXT} before the next substantial action; keep it short. OpenCode owns compaction, and a summary does not prove it ran. Follow the user's current instruction.
</context_checkpoint>`;

export const CONTINUE_INSTRUCTION = `<auto_continue>
The mission has unfinished work. Read ${PATHS.TODO} and the current context, then take the next useful action: do small work directly, delegate only independent bounded scopes, resolve dependencies first, and wait for running subagents instead of duplicating their work.
Mark verified leaves [x] and verified parents status: completed; keep unresolved work visible and resolve ${PATHS.SYNC_ISSUES}. If a verification checklist exists, every item must pass. Missing evidence is not success.
Respect user pause, abort, and changed instructions; report missing input, failed checks, and blockers plainly.
</auto_continue>`;

export const STAGNATION_INTERVENTION = `<system_intervention type="stagnation_detected">
Progress has stalled. Check the actual task status and output, name the blocker, and take a smaller supported step. Do not infer failure from elapsed time or launch duplicate work. If you need input, report it and keep the next action. Respect pause and abort.
</system_intervention>`;

export const CLEANUP_INSTRUCTION = `<system_maintenance type="continuous_hygiene">
Iteration %ITER%: sync ${PATHS.TODO}, ${PATHS.CONTEXT}, and ${PATHS.SYNC_ISSUES} with verified results. Preserve existing files and structure, update only relevant sections, and keep decisions and unfinished work readable. Do not archive, truncate, or delete unrelated documents.
</system_maintenance>`;
