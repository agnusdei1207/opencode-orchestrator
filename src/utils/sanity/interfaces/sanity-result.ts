/**
 * Sanity Result Interface
 */

import type { Severity } from "../types/severity.js";

export interface SanityResult {
    isHealthy: boolean;
    reason?: string;
    severity: Severity;
}
