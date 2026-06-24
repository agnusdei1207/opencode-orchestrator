/**
 * Session Shared Context
 * 
 * Enables context sharing between parent and child sessions
 */

// Re-export interfaces
export type { SharedDocument } from "./interfaces/shared-document.js";
export type { SharedFinding } from "./interfaces/shared-finding.js";
export type { SharedDecision } from "./interfaces/shared-decision.js";
export type { SharedContext } from "./interfaces/shared-context.js";
export type { ContextStats } from "./interfaces/context-stats.js";

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
