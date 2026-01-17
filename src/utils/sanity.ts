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

// ============================================================================
// Severity Constants
// ============================================================================

export const SEVERITY = {
    OK: "ok",
    WARNING: "warning",
    CRITICAL: "critical",
} as const;

export type Severity = (typeof SEVERITY)[keyof typeof SEVERITY];

export interface SanityResult {
    isHealthy: boolean;
    reason?: string;
    severity: Severity;
}

/**
 * Check if LLM output shows signs of degeneration
 */
export function checkOutputSanity(text: string): SanityResult {
    if (!text || text.length < 50) {
        return { isHealthy: true, severity: SEVERITY.OK };
    }

    // Pattern 1: Single character repeated excessively (SSSSSS...)
    // Matches same character repeated 15+ times
    if (/(.)\1{15,}/.test(text)) {
        return {
            isHealthy: false,
            reason: "Single character repetition detected",
            severity: SEVERITY.CRITICAL,
        };
    }

    // Pattern 2: Short pattern repeated (茅茅茅茅..., ████...)
    // Matches 2-6 char patterns repeated 8+ times
    if (/(.{2,6})\1{8,}/.test(text)) {
        return {
            isHealthy: false,
            reason: "Pattern loop detected",
            severity: SEVERITY.CRITICAL,
        };
    }

    // Pattern 3: Very low character diversity
    // Long text with very few unique characters indicates gibberish
    if (text.length > 200) {
        const cleanText = text.replace(/\s/g, "");
        if (cleanText.length > 100) {
            const uniqueChars = new Set(cleanText).size;
            const ratio = uniqueChars / cleanText.length;
            if (ratio < 0.02) {
                // Less than 2% unique characters
                return {
                    isHealthy: false,
                    reason: "Low information density",
                    severity: SEVERITY.CRITICAL,
                };
            }
        }
    }

    // Pattern 4: Excessive block/box drawing characters (visual gibberish)
    // These Unicode ranges: Box Drawing, Block Elements, Braille Patterns
    const boxChars = (
        text.match(/[\u2500-\u257f\u2580-\u259f\u2800-\u28ff]/g) || []
    ).length;
    if (boxChars > 100 && boxChars / text.length > 0.3) {
        return {
            isHealthy: false,
            reason: "Visual gibberish detected",
            severity: SEVERITY.CRITICAL,
        };
    }

    // Pattern 5: Line-by-line repetition check
    // If 80%+ of lines are duplicates, likely a loop
    const lines = text.split("\n").filter((l) => l.trim().length > 10);
    if (lines.length > 10) {
        const lineSet = new Set(lines);
        if (lineSet.size < lines.length * 0.2) {
            return {
                isHealthy: false,
                reason: "Excessive line repetition",
                severity: SEVERITY.WARNING,
            };
        }
    }

    // Pattern 6: CJK character flood without meaningful structure
    // Catches cases like random Chinese/Japanese character spam
    const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    if (cjkChars > 200) {
        // Check if it's just repeated CJK characters
        const uniqueCjk = new Set(
            text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []
        ).size;
        if (uniqueCjk < 10 && cjkChars / uniqueCjk > 20) {
            return {
                isHealthy: false,
                reason: "CJK character spam detected",
                severity: SEVERITY.CRITICAL,
            };
        }
    }

    return { isHealthy: true, severity: SEVERITY.OK };
}

/**
 * Check if text is completely empty or meaningless
 */
export function isEmptyOrMeaningless(text: string): boolean {
    if (!text) return true;
    const cleaned = text.replace(/[\s\n\r\t]/g, "").trim();
    return cleaned.length < 10;
}

/**
 * Recovery prompt for single anomaly
 */
export const RECOVERY_PROMPT = `<anomaly_recovery>
⚠️ SYSTEM NOTICE: Previous output was malformed (gibberish/loop detected).

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

/**
 * Escalation prompt for multiple consecutive anomalies
 */
export const ESCALATION_PROMPT = `<critical_anomaly>
🚨 CRITICAL: Multiple consecutive malformed outputs detected.

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
