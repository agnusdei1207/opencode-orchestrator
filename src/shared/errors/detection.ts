/**
 * Error Detection
 */

import { ERROR_PATTERNS } from "./constants.js";
import type { ErrorPatternType } from "./constants.js";


export function detectErrorType(error: unknown): ErrorPatternType | null {
    const errorStr = typeof error === "string"
        ? error
        : (error as { message?: string; name?: string })?.message
        || (error as { message?: string; name?: string })?.name
        || String(error);

    for (const [type, pattern] of Object.entries(ERROR_PATTERNS)) {
        if (pattern.test(errorStr)) {
            return type as ErrorPatternType;
        }
    }
    return null;
}
