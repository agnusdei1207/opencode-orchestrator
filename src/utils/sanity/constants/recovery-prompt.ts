/**
 * Recovery Prompt Constant
 */

export const RECOVERY_PROMPT = `<anomaly_recovery>
SYSTEM NOTICE: Previous output was malformed (gibberish/loop detected).


<recovery_protocol>
1. DISCARD the corrupted output completely - do not reference it
2. RECALL the original mission objective
3. IDENTIFY the last confirmed successful step
4. RESTART with a simpler, more focused approach
</recovery_protocol>

<instructions>
- If a sub-agent produced bad output: try a different agent or simpler task
- If stuck in a loop: break down the task into smaller pieces
- If context seems corrupted: call Reviewer to restore context
- THINK in English for maximum stability
</instructions>

What was the original task? Proceed from the last known good state.
</anomaly_recovery>`;
