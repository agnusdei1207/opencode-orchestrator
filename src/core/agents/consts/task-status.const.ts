/**
 * TASK_STATUS - Task status constants
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
