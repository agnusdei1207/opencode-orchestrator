/**
 * Output Sanity Checker Logic
 *
 * Detects genuinely degenerate model output — a stuck decoder emitting the same
 * character or phrase forever — without flagging ordinary long answers.
 *
 * The distinction matters because a false positive is expensive: the sanity hook
 * injects a recovery prompt into the live session, so a detector that misfires
 * on normal output produces a stream of "ANOMALY" notices that burn tokens and
 * derail the run (issue #35).
 *
 * Two rules every detector here follows:
 *
 * 1. **Scale invariance.** A measure that drifts as text grows will eventually
 *    cross any fixed threshold, making long-but-healthy output indistinguishable
 *    from garbage.
 * 2. **Structure is not degeneration.** Markdown rules, ASCII separators, box
 *    drawing and table rules are formatting an agent is *supposed* to emit.
 *    Repetition of non-alphanumeric characters is only suspicious in extremes.
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

/**
 * A single alphanumeric character repeated 16+ times ("aaaaaaaaaaaaaaaaaa").
 * Prose and code never do this; a stuck decoder does. The threshold is unchanged
 * from the original detector — only the non-alphanumeric case needed relaxing.
 */
const ALPHANUMERIC_RUN = /([0-9A-Za-z])\1{15,}/;
/**
 * Any single character repeated 200+ times. Deliberately far above the longest
 * plausible separator: a 76-character `====` banner or a markdown horizontal
 * rule is normal formatting, a 200-character run is not.
 */
const EXTREME_CHARACTER_RUN = /(.)\1{199,}/;
/**
 * A 2-6 character unit repeated 9+ times. Unit length and repetition count are
 * unchanged from the original detector; what is new is that the repeated unit
 * must carry an alphanumeric character (see `detectPatternLoop`).
 */
const SHORT_PATTERN_REPETITION = /(.{2,6})\1{8,}/g;
/** Guard against pathological scanning on very large inputs. */
const PATTERN_LOOP_MAX_MATCHES = 32;
const ALPHANUMERIC_CHARACTER = /[0-9A-Za-z]/;

const WHITESPACE_PATTERN = /\s/g;
const BOX_CHARACTER_PATTERN = /[─-╿▀-▟⠀-⣿]/g;
const CJK_CHARACTER_PATTERN = /[一-鿿㐀-䶿]/g;

/**
 * Entropy is measured over at most this many characters. Bounding the sample
 * keeps the check cheap on huge tool outputs and keeps the statistic comparable
 * across inputs of very different sizes.
 */
const ENTROPY_SAMPLE_LENGTH = 4000;
const ENTROPY_MIN_CLEAN_LENGTH = 200;
/**
 * Below this many distinct characters, text is a candidate for the entropy
 * check. Anything drawing on a real alphabet (prose, code, hex dumps, base64)
 * clears it immediately and is never inspected further.
 */
const MIN_UNIQUE_CHARACTERS = 12;
/**
 * Shannon entropy floor in bits per character. Healthy prose and source code sit
 * around 4.0-4.8 bits; a decoder cycling a handful of tokens falls well below.
 * Text that reaches this check has at most 11 distinct characters, capping its
 * entropy at log2(11) ≈ 3.46 bits, so the threshold still leaves headroom for a
 * genuinely varied small alphabet while catching skewed cycles.
 */
const MIN_ENTROPY_BITS = 2.5;

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
    return ALPHANUMERIC_RUN.test(text) || EXTREME_CHARACTER_RUN.test(text)
        ? unhealthyResult("Single character repetition detected", SEVERITY.CRITICAL)
        : null;
}

/**
 * Flag a short unit repeated many times, but only when the unit carries an
 * alphanumeric character.
 *
 * Purely structural runs — markdown table rules (`|---|---|---|…`), ASCII
 * dividers (`-=-=-=-=`), box drawing — are formatting an agent is supposed to
 * emit, and the unrestricted pattern flagged every wide markdown table this
 * project's own agents produce. A decoder actually stuck in a loop repeats
 * content, not punctuation.
 *
 * Scans past structural matches rather than stopping at the first one, so a real
 * loop later in the text is still caught.
 */
function detectPatternLoop(text: string): SanityResult | null {
    SHORT_PATTERN_REPETITION.lastIndex = 0;

    for (let seen = 0; seen < PATTERN_LOOP_MAX_MATCHES; seen++) {
        const match = SHORT_PATTERN_REPETITION.exec(text);
        if (!match) return null;
        if (ALPHANUMERIC_CHARACTER.test(match[1])) {
            return unhealthyResult("Pattern loop detected", SEVERITY.CRITICAL);
        }
    }

    return null;
}

/**
 * Flag output whose character distribution carries almost no information.
 *
 * Uses Shannon entropy rather than a unique/total character ratio. That ratio is
 * not scale-invariant: distinct characters saturate near the size of the
 * alphabet (~90 for English) while the denominator grows without bound, so *any*
 * sufficiently long healthy answer eventually drops below a fixed ratio. Five
 * kilobytes of ordinary prose scores ~0.004 against a 0.02 threshold, which is
 * why this fired on essentially every substantial turn. Entropy per character
 * has no such drift.
 */
function detectLowInformationDensity(text: string): SanityResult | null {
    const cleanText = text.replace(WHITESPACE_PATTERN, "").slice(0, ENTROPY_SAMPLE_LENGTH);
    if (cleanText.length < ENTROPY_MIN_CLEAN_LENGTH) return null;

    const frequencies = characterFrequencies(cleanText);
    if (frequencies.size >= MIN_UNIQUE_CHARACTERS) return null;

    return shannonEntropyBits(frequencies, cleanText.length) < MIN_ENTROPY_BITS
        ? unhealthyResult("Low information density", SEVERITY.CRITICAL)
        : null;
}

function characterFrequencies(text: string): Map<string, number> {
    const frequencies = new Map<string, number>();
    for (const character of text) {
        frequencies.set(character, (frequencies.get(character) ?? 0) + 1);
    }
    return frequencies;
}

/** Shannon entropy of a character distribution, in bits per character. */
export function shannonEntropyBits(frequencies: Map<string, number>, total: number): number {
    if (total <= 0) return 0;

    let entropy = 0;
    for (const count of frequencies.values()) {
        const probability = count / total;
        entropy -= probability * Math.log2(probability);
    }
    return entropy;
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
