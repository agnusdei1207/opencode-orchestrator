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

export const STAGNATION_INTERVENTION = `
<system_intervention type="stagnation_detected">
⚠️ **경고: 진행 정체 감지 (STAGNATION DETECTED)**
최근 여러 턴 동안 실질적인 진전이 감지되지 않았습니다. 단순 "모니터링"이나 같은 행동을 반복하는 것은 금지됩니다.

**자율적 진단 및 해결 지침:**
1. **실시간 로그 확인**: \`check_background_task\` 또는 \`read_file\`을 사용하여 진행 중인 작업의 출력 로그를 직접 확인하십시오.
2. **프로세스 생존 진단**: 작업이 좀비 상태이거나 멈춘 것 같다면 과감하게 \`kill\`하고 단계를 세분화하여 다시 실행하십시오.
3. **전략 전환**: 동일한 접근 방식이 실패하고 있다면, 다른 도구나 방법을 사용하여 목표에 도달하십시오.

**지금 바로 능동적으로 개입하십시오. 대기하지 마십시오.**
</system_intervention>`;

export const CLEANUP_INSTRUCTION = `
<system_maintenance type="continuous_hygiene">
🧹 **DOCUMENTATION & STATE HYGIENE (Iteration %ITER%)**
You must maintain a pristine workspace. **As part of your move**, perform these checks:

1. **Relevance Assessment**:
   - Review active documents (\`.opencode/*.md\`). Are they needed for the *current* objective?
   - If a file represents a solved problem or obsolete context, **Archive it** to \`.opencode/archive/\` or delete it.

2. **Synchronization**:
   - Verify \`TODO.md\` matches the actual code state. Mark completed items immediately.
   - Check \`sync-issues.md\`. If issues are resolved, remove them.

3. **Context Optimization**:
   - If \`work-log.md\` is getting noisy, summarize key decisions into \`summary.md\` and truncate the log.
   - Keep context lightweight.

**Rule**: A cluttered workspace leads to hallucinations. Clean as you go.
</system_maintenance>
`;

