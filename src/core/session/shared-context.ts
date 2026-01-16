/**
 * Session Shared Context
 * 
 * Enables context sharing between parent and child sessions
 */

// Re-export interfaces
export type {
    SharedDocument,
    SharedFinding,
    SharedDecision,
    SharedContext,
    ContextStats,
} from "./interfaces.js";

// Re-export store operations
export {
    create,
    get,
    getMerged,
    addDocument,
    addFinding,
    addDecision,
    getChildren,
    clear,
    clearAll,
    getStats,
} from "./store.js";

// Re-export summary
export { getSummary } from "./summary.js";
