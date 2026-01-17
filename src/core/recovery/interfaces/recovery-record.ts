/**
 * Recovery Record Interface
 */

import type { ErrorContext } from "./error-context.js";
import type { RecoveryAction } from "./recovery-action.js";

export interface RecoveryRecord {
    context: ErrorContext;
    action: RecoveryAction;
    timestamp: Date;
}
