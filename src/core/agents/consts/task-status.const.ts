/**
 * TASK_STATUS - Task status constants (for parallel tasks)
 */

export const TASK_STATUS = {
    PENDING: "pending",
    RUNNING: "running",
    COMPLETED: "completed",
    FAILED: "failed",
    ERROR: "error",
    TIMEOUT: "timeout",
    CANCELLED: "cancelled",
} as const;

/**
 * TODO_STATUS - Todo item status constants
 */
export const TODO_STATUS = {
    PENDING: "pending",
    IN_PROGRESS: "in_progress",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
} as const;
