import { MISSION_CONTROL } from "../loop/constants/mission-control.js";
import { PATHS } from "../core/constants/paths.js";

/**
 * System Messages & Templates
 * 
 * Centralized storage for long prompt templates, user messages, and notifications.
 */

export const MISSION_MESSAGES = {
  START_LOG: `[${MISSION_CONTROL.LOG_SOURCE}] Detected /task command. Starting mission...`,
  CANCEL_LOG: `[${MISSION_CONTROL.LOG_SOURCE}] Detected user cancellation signal.`,
  COMPLETE_LOG: `[${MISSION_CONTROL.LOG_SOURCE}] Mission Verified! Finishing loop.`,

  TOAST_COMPLETE_TITLE: "Mission Complete",
  TOAST_COMPLETE_MESSAGE: "Mission verified and finished.",

  STOP_TRIGGER: "STOP MISSION",
  CANCEL_TRIGGER: "CANCEL MISSION",

  // UI Messages
  AGENT_HEADER_FORMAT: (indicator: string, name: string) => `[${indicator}] [${name}] Working...\n\n`,

  // Security Messages
  BLOCK_REASON_FORK_BOMB: "Fork bomb detected.",
  BLOCK_REASON_ROOT_DELETE: "Root deletion blocked.",
  SECRET_REDACTED_MSG: "********** [SECRET REDACTED] **********",

  // Sanity Messages
  ANOMALY_DETECTED_TITLE: (name: string) => `[${name}] OUTPUT ANOMALY DETECTED`,
  ANOMALY_DETECTED_BODY: (reason: string, count: number, recoveryText: string) =>
    `Gibberish/loop detected: ${reason}\n` +
    `Anomaly count: ${count}\n\n` +
    `${recoveryText}`,
  ANOMALY_INJECT_MSG: (count: number, reason: string, recoveryText: string) =>
    `⚠️ ANOMALY #${count}: ${reason}\n\n${recoveryText}`
} as const;

export const COMPACTION_PROMPT = `
<system_interrupt type="memory_compaction">
⚠️ **CRITICAL: Context Memory High ($USAGE%)**

Your context window is filling up. To prevent memory loss:
1. **STOP** your current task immediately.
2. **SUMMARIZE** all completed work and pending todos.
3. **UPDATE** the file \`${PATHS.CONTEXT}\` with this summary.
   - Keep it concise but lossless (don't lose task IDs).
   - Section: ## Current Status, ## Pending Tasks.
4. After updating, output exactly: \`[COMPACTION_COMPLETE]\`

Do this NOW before proceeding.
</system_interrupt>
`;

export const CONTINUE_INSTRUCTION = `<auto_continue>
<status>Mission not complete. Keep executing.</status>

<rules>
1. DO NOT stop - mission is incomplete
2. DO NOT wait for user input
3. **PROACTIVE THINKING MANDATORY**: If background tasks are running, use the time to:
   - Run \`check_background_task\` to audit logs and ensure no deadlocks.
   - speculatively plan the next steps or prepare necessary code templates.
   - execute independent sub-tasks from the TODO list.
4. If previous action failed, try different approach
5. Breakdown abstract tasks into Grade 3 sub-tasks before execution
</rules>

<next_step>
1. Read: \`cat ${PATHS.TODO}\`
2. Find the first \`[ ]\` uncompleted item
3. Execute that task NOW
4. Mark \`[x]\` ONLY after tool-based verification
5. Repeat until ALL items (Grade 1, 2, 3) are \`[x]\`
</next_step>

<completion_mandate>
⚠️ SYSTEM VERIFICATION ACTIVE
- Completion will be BLOCKED if any \`[ ]\` remain in ${PATHS.TODO}
- Completion will be BLOCKED if any unresolved sync-issues exist
- Verify 100% completion before concluding
</completion_mandate>
</auto_continue>`;

