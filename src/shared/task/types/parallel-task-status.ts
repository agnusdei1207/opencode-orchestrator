/**
 * Parallel task status values
 */
export type ParallelTaskStatus =
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "error"
    | "timeout"
    | "cancelled";
