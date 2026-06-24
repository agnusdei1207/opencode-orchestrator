/**
 * Auto Recovery System
 * 
 * Automatically handles and recovers from common errors
 */

// Re-export public recovery types
export type {
    RecoveryAction,
    ErrorContext,
    RecoveryRecord,
    RecoveryStats,
} from "./handler.js";
export type { ErrorPattern } from "./patterns.js";

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
