/**
 * Recovery Prompt Constant
 */

export const RECOVERY_PROMPT = `<anomaly_recovery>
The previous output was malformed (gibberish or a repetition loop). Ignore it.
Recall the original objective, find the last confirmed successful step, and continue from there with a simpler, smaller step.
</anomaly_recovery>`;
