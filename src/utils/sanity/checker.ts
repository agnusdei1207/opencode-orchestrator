/**
 * Output Sanity Checker Logic
 */

import { SEVERITY } from "./constants/severity.js";
import type { SanityResult } from "./interfaces/sanity-result.js";

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
    if (text.length > 200) {
        const cleanText = text.replace(/\s/g, "");
        if (cleanText.length > 100) {
            const uniqueChars = new Set(cleanText).size;
            const ratio = uniqueChars / cleanText.length;
            if (ratio < 0.02) {
                return {
                    isHealthy: false,
                    reason: "Low information density",
                    severity: SEVERITY.CRITICAL,
                };
            }
        }
    }

    // Pattern 4: Excessive block/box drawing characters (visual gibberish)
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

    // Pattern 6: CJK character flood
    const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    if (cjkChars > 200) {
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
