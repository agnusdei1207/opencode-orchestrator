/**
 * Error Pattern Interface
 */

import type { ErrorContext } from "./error-context.js";
import type { RecoveryAction } from "./recovery-action.js";

export interface ErrorPattern {
    pattern: RegExp | string;
    category: string;
    handler: (context: ErrorContext) => RecoveryAction;
}
