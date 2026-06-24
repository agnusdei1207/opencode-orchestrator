/**
 * Task Decomposer
 * 
 * Automatically decomposes complex tasks into hierarchical subtasks
 */

// Re-export interfaces
export type { TaskStatus, TaskNode } from "./interfaces/task-node.js";
export type { TaskHierarchy } from "./interfaces/task-hierarchy.js";
export type { TaskProgress } from "./interfaces/task-progress.js";
export type { TaskInput } from "./interfaces/task-input.js";

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
