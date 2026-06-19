/**
 * Tolerant JSON parsing for model- and network-authored payloads.
 *
 * Builder learning (adoption assessment 2026-06-19, item F): LLM/provider output
 * and fetched bodies are frequently wrapped in markdown fences, padded with
 * prose, or left with trailing commas. Instead of hard-failing, attempt a small
 * sequence of repairs and fall back gracefully.
 *
 * This is intentionally NOT used for our own machine-written state files
 * (mission-loop.json, ledger, cache) where a strict parse should surface
 * corruption rather than mask it.
 */

function stripCodeFence(input: string): string {
    const trimmed = input.trim();
    // ```json\n...\n```  or  ```\n...\n```
    const fence = /^```[a-zA-Z0-9]*\s*\n([\s\S]*?)\n```$/;
    const match = trimmed.match(fence);
    return match ? match[1].trim() : trimmed;
}

/** Slice from the first opening bracket to its matching last bracket. */
function extractBracketed(input: string): string | null {
    const firstObj = input.indexOf("{");
    const firstArr = input.indexOf("[");
    const candidates = [firstObj, firstArr].filter((i) => i >= 0);
    if (candidates.length === 0) return null;
    const start = Math.min(...candidates);
    const open = input[start];
    const close = open === "{" ? "}" : "]";
    const end = input.lastIndexOf(close);
    if (end <= start) return null;
    return input.slice(start, end + 1);
}

function removeTrailingCommas(input: string): string {
    return input.replace(/,(\s*[}\]])/g, "$1");
}

/**
 * Parse JSON, repairing common LLM/network defects. Returns `fallback`
 * (default `null`) if every attempt fails.
 */
export function safeJsonParse<T = unknown>(input: unknown, fallback: T | null = null): T | null {
    if (typeof input !== "string") return fallback;
    const cleaned = stripCodeFence(input);
    if (!cleaned) return fallback;

    const attempts: string[] = [cleaned];
    const bracketed = extractBracketed(cleaned);
    if (bracketed && bracketed !== cleaned) attempts.push(bracketed);
    attempts.push(removeTrailingCommas(bracketed ?? cleaned));

    for (const candidate of attempts) {
        try {
            return JSON.parse(candidate) as T;
        } catch {
            // try the next repair
        }
    }
    return fallback;
}
