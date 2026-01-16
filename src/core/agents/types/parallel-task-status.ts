/**
 * ParallelTaskStatus - Task status union type
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

export type ParallelTaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];
