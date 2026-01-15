export interface SanityResult {
    isHealthy: boolean;
    reason?: string;
    severity: "ok" | "warning" | "critical";
}

export function checkOutputSanity(text: string): SanityResult {
    if (!text || text.length < 50) {
        return { isHealthy: true, severity: "ok" };
    }

    if (/(.)\1{15,}/.test(text)) {
        return {
            isHealthy: false,
            reason: "Single character repetition detected",
            severity: "critical",
        };
    }

    if (/(.{2,6})\1{8,}/.test(text)) {
        return {
            isHealthy: false,
            reason: "Pattern loop detected",
            severity: "critical",
        };
    }

    if (text.length > 200) {
        const cleanText = text.replace(/\s/g, "");
        if (cleanText.length > 100) {
            const uniqueChars = new Set(cleanText).size;
            const ratio = uniqueChars / cleanText.length;
            if (ratio < 0.02) {
                return {
                    isHealthy: false,
                    reason: "Low information density",
                    severity: "critical",
                };
            }
        }
    }

    const boxChars = (
        text.match(/[\u2500-\u257f\u2580-\u259f\u2800-\u28ff]/g) || []
    ).length;
    if (boxChars > 100 && boxChars / text.length > 0.3) {
        return {
            isHealthy: false,
            reason: "Visual gibberish detected",
            severity: "critical",
        };
    }

    const lines = text.split("\n").filter((l) => l.trim().length > 10);
    if (lines.length > 10) {
        const lineSet = new Set(lines);
        if (lineSet.size < lines.length * 0.2) {
            return {
                isHealthy: false,
                reason: "Excessive line repetition",
                severity: "warning",
            };
        }
    }

    const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    if (cjkChars > 200) {
        const uniqueCjk = new Set(
            text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []
        ).size;
        if (uniqueCjk < 10 && cjkChars / uniqueCjk > 20) {
            return {
                isHealthy: false,
                reason: "CJK character spam detected",
                severity: "critical",
            };
        }
    }

    return { isHealthy: true, severity: "ok" };
}

export function isEmptyOrMeaningless(text: string): boolean {
    if (!text) return true;
    const cleaned = text.replace(/[\s\n\r\t]/g, "").trim();
    return cleaned.length < 10;
}

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
- If context seems corrupted: call recorder to restore context
- THINK in English for maximum stability
</instructions>

What was the original task? Proceed from the last known good state.
</anomaly_recovery>`;

export const ESCALATION_PROMPT = `<critical_anomaly>
🚨 CRITICAL: Multiple consecutive malformed outputs detected.

<emergency_protocol>
1. STOP current execution path immediately
2. DO NOT continue with the same approach - it is failing
3. CALL architect for a completely new strategy
4. If architect also fails: report status to user and await guidance
</emergency_protocol>

<diagnosis>
The current approach is producing corrupted output.
This may indicate: context overload, model instability, or task complexity.
</diagnosis>

Request a fresh plan from architect with reduced scope.
</critical_anomaly>`;
