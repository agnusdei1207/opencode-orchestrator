/**
 * Auto Recovery System
 * 
 * Automatically handles and recovers from common errors
 */

// Re-export interfaces
export type {
    RecoveryAction,
    ErrorContext,
    ErrorPattern,
    RecoveryRecord,
    RecoveryStats,
} from "./interfaces.js";

// Re-export constants
export { MAX_RETRIES, BASE_DELAY, MAX_HISTORY } from "./constants.js";

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
