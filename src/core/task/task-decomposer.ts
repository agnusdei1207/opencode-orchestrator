/**
 * Task Decomposer
 * 
 * Automatically decomposes complex tasks into hierarchical subtasks
 */

// Re-export store-owned contracts
export type {
    TaskStatus,
    TaskNode,
    TaskHierarchy,
    TaskProgress,
    TaskInput,
} from "./store.js";

// Re-export store operations
export {
    create,
    getHierarchy,
    addTask,
    updateStatus,
    clear,
    isComplete,
    getProgress,
} from "./store.js";

// Re-export scheduler
export {
    getNextTasks,
    getParallelBatch,
} from "./scheduler.js";

// Re-export parser
export { parseFromText } from "./parser.js";

// Re-export summary
export { getSummary } from "./summary.js";
