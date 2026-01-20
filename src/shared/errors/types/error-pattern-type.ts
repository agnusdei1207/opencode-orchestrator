/**
 * Error Type Type Definition
 */

import { ERROR_PATTERNS } from "../constants/error-patterns.js";

export type ErrorPatternType = keyof typeof ERROR_PATTERNS;
