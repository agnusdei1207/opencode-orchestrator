/**
 * Output Sanity Checker Logic
 */

import { SEVERITY } from "./constants/severity.js";

export type Severity = (typeof SEVERITY)[keyof typeof SEVERITY];

export interface SanityResult {
    isHealthy: boolean;
    reason?: string;
    severity: Severity;
}

type SanityDetector = (text: string) => SanityResult | null;

const MIN_CHECK_LENGTH = 50;
const SINGLE_CHARACTER_REPETITION = /(.)\1{15,}/;
const SHORT_PATTERN_REPETITION = /(.{2,6})\1{8,}/;
const WHITESPACE_PATTERN = /\s/g;
const BOX_CHARACTER_PATTERN = /[\u2500-\u257f\u2580-\u259f\u2800-\u28ff]/g;
const CJK_CHARACTER_PATTERN = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

const DIVERSITY_TEXT_LENGTH = 200;
const DIVERSITY_CLEAN_LENGTH = 100;
const LOW_DIVERSITY_RATIO = 0.02;
const BOX_CHARACTER_COUNT = 100;
const BOX_CHARACTER_RATIO = 0.3;
const LINE_REPETITION_COUNT = 10;
const LINE_REPETITION_MIN_LENGTH = 10;
const LINE_REPETITION_UNIQUE_RATIO = 0.2;
const CJK_CHARACTER_COUNT = 200;
const CJK_UNIQUE_LIMIT = 10;
const CJK_REPETITION_RATIO = 20;

const DETECTORS: SanityDetector[] = [
    detectSingleCharacterRepetition,
    detectPatternLoop,
    detectLowInformationDensity,
    detectVisualGibberish,
    detectLineRepetition,
    detectCjkSpam,
];

/**
 * Check if LLM output shows signs of degeneration
 */
export function checkOutputSanity(text: string): SanityResult {
    if (!text || text.length < MIN_CHECK_LENGTH) {
        return healthyResult();
    }

    for (const detector of DETECTORS) {
        const result = detector(text);
        if (result) return result;
    }

    return healthyResult();
}

function detectSingleCharacterRepetition(text: string): SanityResult | null {
    return SINGLE_CHARACTER_REPETITION.test(text)
        ? unhealthyResult("Single character repetition detected", SEVERITY.CRITICAL)
        : null;
}

function detectPatternLoop(text: string): SanityResult | null {
    return SHORT_PATTERN_REPETITION.test(text)
        ? unhealthyResult("Pattern loop detected", SEVERITY.CRITICAL)
        : null;
}

function detectLowInformationDensity(text: string): SanityResult | null {
    if (text.length <= DIVERSITY_TEXT_LENGTH) return null;

    const cleanText = text.replace(WHITESPACE_PATTERN, "");
    if (cleanText.length <= DIVERSITY_CLEAN_LENGTH) return null;

    const uniqueChars = new Set(cleanText).size;
    const ratio = uniqueChars / cleanText.length;
    return ratio < LOW_DIVERSITY_RATIO
        ? unhealthyResult("Low information density", SEVERITY.CRITICAL)
        : null;
}

function detectVisualGibberish(text: string): SanityResult | null {
    const boxChars = countMatches(text, BOX_CHARACTER_PATTERN);
    return boxChars > BOX_CHARACTER_COUNT && boxChars / text.length > BOX_CHARACTER_RATIO
        ? unhealthyResult("Visual gibberish detected", SEVERITY.CRITICAL)
        : null;
}

function detectLineRepetition(text: string): SanityResult | null {
    const lines = text.split("\n").filter((line) => line.trim().length > LINE_REPETITION_MIN_LENGTH);
    if (lines.length <= LINE_REPETITION_COUNT) return null;

    const lineSet = new Set(lines);
    return lineSet.size < lines.length * LINE_REPETITION_UNIQUE_RATIO
        ? unhealthyResult("Excessive line repetition", SEVERITY.WARNING)
        : null;
}

function detectCjkSpam(text: string): SanityResult | null {
    const cjkMatches = text.match(CJK_CHARACTER_PATTERN) || [];
    if (cjkMatches.length <= CJK_CHARACTER_COUNT) return null;

    const uniqueCjk = new Set(cjkMatches).size;
    return uniqueCjk < CJK_UNIQUE_LIMIT && cjkMatches.length / uniqueCjk > CJK_REPETITION_RATIO
        ? unhealthyResult("CJK character spam detected", SEVERITY.CRITICAL)
        : null;
}

function countMatches(text: string, pattern: RegExp): number {
    return (text.match(pattern) || []).length;
}

function healthyResult(): SanityResult {
    return { isHealthy: true, severity: SEVERITY.OK };
}

function unhealthyResult(reason: string, severity: Severity): SanityResult {
    return { isHealthy: false, reason, severity };
}
