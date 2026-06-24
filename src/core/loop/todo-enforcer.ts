/**
 * Todo Enforcer
 * 
 * Ensures all todos are completed before stopping
 */

// Re-export shared loop contracts
export type { Todo, TodoStats, TodoStatus, TodoPriority } from "../../shared/loop/types.js";

// Re-export parser
export { parseTodos } from "./parser.js";

// Re-export stats
export {
    getIncompleteCount,
    hasRemainingWork,
    getNextPending,
    getStats,
    isMissionComplete,
} from "./stats.js";

// Re-export formatters
export {
    formatProgress,
    generateContinuationPrompt,
    generateCompletionMessage,
} from "./formatters.js";
