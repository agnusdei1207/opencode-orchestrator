/**
 * Error Detection
 */

import { ERROR_PATTERNS } from "./constants.js";
import type { ErrorPatternType } from "./constants.js";


interface ErrorLike {
    message?: unknown;
    name?: unknown;
    data?: { message?: unknown };
}

// OpenCode session errors are NamedError.toObject() payloads, `{ name, data: { message } }`,
// so the provider's message lives under `data`, not at the top level. The name is
// kept alongside it because some types (MessageAbortedError) are identified by name.
function readErrorText(error: unknown): string {
    if (typeof error === "string") return error;
    const candidate = (error ?? {}) as ErrorLike;
    const texts = [candidate.message, candidate.data?.message, candidate.name]
        .filter((text): text is string => typeof text === "string" && text.length > 0);
    return texts.length > 0 ? texts.join(" ") : String(error);
}

export function detectErrorType(error: unknown): ErrorPatternType | null {
    const errorStr = readErrorText(error);

    for (const [type, pattern] of Object.entries(ERROR_PATTERNS)) {
        if (pattern.test(errorStr)) {
            return type as ErrorPatternType;
        }
    }
    return null;
}
