/**
 * Task status constants and mappings
 */

// ============================================================================
// Task Status Types
// ============================================================================

export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "done"
  | "error"
  | "timeout";

export type ParallelTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "error"
  | "timeout";

// ============================================================================
// Status Emoji Mappings
// ============================================================================

export const STATUS_EMOJI: Record<string, string> = {
  pending: "⏸️",
  running: "⏳",
  completed: "✅",
  done: "✅",
  error: "❌",
  timeout: "⏰",
};

/**
 * Get emoji for task status
 */
export function getStatusEmoji(status: TaskStatus | ParallelTaskStatus | string): string {
  return STATUS_EMOJI[status] || "❓";
}

// ============================================================================
// Task ID Prefixes
// ============================================================================

export const TASK_ID_PREFIX = "task_";
export const JOB_ID_PREFIX = "job_";
