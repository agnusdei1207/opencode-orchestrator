/**
 * Auto Recovery System
 * 
 * Automatically handles and recovers from common errors
 */

// Re-export public recovery types
export type { RecoveryAction } from "./interfaces/recovery-action.js";
export type { ErrorContext } from "./interfaces/error-context.js";
export type { ErrorPattern } from "./interfaces/error-pattern.js";
export type { RecoveryRecord } from "./interfaces/recovery-record.js";
export type { RecoveryStats } from "./interfaces/recovery-stats.js";

// Re-export patterns
export { errorPatterns } from "./patterns.js";

// Re-export handler functions
export {
    handleError,
    withRecovery,
    getStats,
    getHistory,
    clearSession,
} from "./handler.js";
