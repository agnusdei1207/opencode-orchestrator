/**
 * Escalation Prompt Constant
 */

export const ESCALATION_PROMPT = `<critical_anomaly>
Several consecutive outputs were malformed. Stop the current approach: it is failing.
Re-plan the remaining work with a smaller scope, from the last verified step. If the output stays malformed, report the status to the user and wait for guidance.
</critical_anomaly>`;
