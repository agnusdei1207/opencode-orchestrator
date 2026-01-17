/**
 * Filter Status (for list operations)
 */

export const FILTER_STATUS = {
    ALL: "all",
    RUNNING: "running",
    DONE: "done",
    COMPLETED: "completed",
    ERROR: "error",
    PENDING: "pending",
} as const;

export type FilterStatus = (typeof FILTER_STATUS)[keyof typeof FILTER_STATUS];
