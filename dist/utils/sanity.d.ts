/**
 * Output Sanity Check - LLM degeneration/gibberish detection
 *
 * Detects common LLM failure modes:
 * - Single character repetition (SSSSSS...)
 * - Pattern loops (茅茅茅茅...)
 * - Low information density
 * - Visual gibberish (box drawing characters)
 * - Line repetition
 */
export declare const SEVERITY: {
    readonly OK: "ok";
    readonly WARNING: "warning";
    readonly CRITICAL: "critical";
};
export type Severity = (typeof SEVERITY)[keyof typeof SEVERITY];
export interface SanityResult {
    isHealthy: boolean;
    reason?: string;
    severity: Severity;
}
/**
 * Check if LLM output shows signs of degeneration
 */
export declare function checkOutputSanity(text: string): SanityResult;
/**
 * Check if text is completely empty or meaningless
 */
export declare function isEmptyOrMeaningless(text: string): boolean;
/**
 * Recovery prompt for single anomaly
 */
export declare const RECOVERY_PROMPT = "<anomaly_recovery>\n\u26A0\uFE0F SYSTEM NOTICE: Previous output was malformed (gibberish/loop detected).\n\n<recovery_protocol>\n1. DISCARD the corrupted output completely - do not reference it\n2. RECALL the original mission objective\n3. IDENTIFY the last confirmed successful step\n4. RESTART with a simpler, more focused approach\n</recovery_protocol>\n\n<instructions>\n- If a sub-agent produced bad output: try a different agent or simpler task\n- If stuck in a loop: break down the task into smaller pieces\n- If context seems corrupted: call Recorder to restore context\n- THINK in English for maximum stability\n</instructions>\n\nWhat was the original task? Proceed from the last known good state.\n</anomaly_recovery>";
/**
 * Escalation prompt for multiple consecutive anomalies
 */
export declare const ESCALATION_PROMPT = "<critical_anomaly>\n\uD83D\uDEA8 CRITICAL: Multiple consecutive malformed outputs detected.\n\n<emergency_protocol>\n1. STOP current execution path immediately\n2. DO NOT continue with the same approach - it is failing\n3. CALL Architect for a completely new strategy\n4. If Architect also fails: report status to user and await guidance\n</emergency_protocol>\n\n<diagnosis>\nThe current approach is producing corrupted output.\nThis may indicate: context overload, model instability, or task complexity.\n</diagnosis>\n\nRequest a fresh plan from Architect with reduced scope.\n</critical_anomaly>";
