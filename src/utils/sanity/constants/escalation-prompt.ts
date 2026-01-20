/**
 * Escalation Prompt Constant
 */

export const ESCALATION_PROMPT = `<critical_anomaly>
CRITICAL: Multiple consecutive malformed outputs detected.


<emergency_protocol>
1. STOP current execution path immediately
2. DO NOT continue with the same approach - it is failing
3. CALL Planner for a completely new strategy
4. If Planner also fails: report status to user and await guidance
</emergency_protocol>

<diagnosis>
The current approach is producing corrupted output.
This may indicate: context overload, model instability, or task complexity.
</diagnosis>

Request a fresh plan from Planner with reduced scope.
</critical_anomaly>`;
