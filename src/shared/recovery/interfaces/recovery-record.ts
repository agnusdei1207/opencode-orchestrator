/**
 * Recovery history record
 */
import type { ErrorContext } from "./error-context.js";
import type { RecoveryAction } from "../types/index.js";

export interface RecoveryRecord {
    context: ErrorContext;
    action: RecoveryAction;
    timestamp: Date;
}
