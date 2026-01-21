import { SEAL_PATTERN } from "../../core/loop/mission-seal.js";

/**
 * System Messages & Templates
 * 
 * Centralized storage for long prompt templates, user messages, and notifications.
 */

export const MISSION_MESSAGES = {
    START_LOG: "[MissionControl] Detected /task command. Starting mission...",
    CANCEL_LOG: "[MissionControl] Detected user cancellation signal.",
    SEAL_LOG: "[MissionControl] Mission Seal detected! Finishing loop.",

    TOAST_COMPLETE_TITLE: "Mission Complete",
    TOAST_COMPLETE_MESSAGE: "Agent sealed the mission.",

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
3. **UPDATE** the file \`./.opencode/context.md\` with this summary.
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
3. If previous action failed, try different approach
4. If agent returned nothing, proceed to next step
5. Check your todo list - complete ALL pending items
</rules>

<next_step>
1. Check todo list for incomplete items
2. Identify the highest priority pending task
3. Execute it NOW
4. Mark complete when done
5. Continue until ALL todos are complete
</next_step>

<completion_criteria>
You are ONLY done when:
- All todos are marked complete or cancelled
- All features are implemented and tesWait:
1. Don't ask for permission
2. Check works
3. Only when done:
Then output: ${SEAL_PATTERN}
</completion_criteria>
</auto_continue>`;
