/**
 * ParallelTaskStatus - Task status type
 */

export type ParallelTaskStatus =
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "error"
    | "timeout"
    | "cancelled";
