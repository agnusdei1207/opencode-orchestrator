/**
 * Centralized Constants
 * 
 * All magic numbers, prefixes, and names in one place.
 */

// ============================================================================
// Time Constants
// ============================================================================

export const TIME = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
} as const;

// ============================================================================
// ID Prefixes - Use these for generating IDs
// ============================================================================

export const ID_PREFIX = {
    /** Parallel agent task ID (e.g., task_a1b2c3d4) */
    TASK: "task_",
    /** Background command job ID (e.g., job_a1b2c3d4) */
    JOB: "job_",
    /** Session ID prefix */
    SESSION: "session_",
} as const;

// ============================================================================
// Parallel Task Configuration
// ============================================================================

export const PARALLEL_TASK = {
    TTL_MS: 60 * TIME.MINUTE,           // 60분 (증가)
    CLEANUP_DELAY_MS: 10 * TIME.MINUTE,  // 10분 (증가)
    MIN_STABILITY_MS: 3 * TIME.SECOND,   // 3초 (감소, 더 빠른 감지)
    POLL_INTERVAL_MS: 1000,              // 1초 (감소, 더 빠른 폴링)
    DEFAULT_CONCURRENCY: 10,             // 10개 (증가: 대규모 병렬 처리)
    MAX_CONCURRENCY: 50,                 // 50개 (증가: 분산 처리용)
} as const;

// ============================================================================
// Background Task Configuration
// ============================================================================

export const BACKGROUND_TASK = {
    DEFAULT_TIMEOUT_MS: 5 * TIME.MINUTE,
    MAX_OUTPUT_LENGTH: 10000,
} as const;

// ============================================================================
// Tool Names - Use these when referencing tools
// ============================================================================

export const TOOL_NAMES = {
    // Parallel task tools
    DELEGATE_TASK: "delegate_task",
    GET_TASK_RESULT: "get_task_result",
    LIST_TASKS: "list_tasks",
    CANCEL_TASK: "cancel_task",
    // Background command tools
    RUN_BACKGROUND: "run_background",
    CHECK_BACKGROUND: "check_background",
    LIST_BACKGROUND: "list_background",
    KILL_BACKGROUND: "kill_background",
    // Search tools
    GREP_SEARCH: "grep_search",
    GLOB_SEARCH: "glob_search",
    MGREP: "mgrep",
    // Other tools
    CALL_AGENT: "call_agent",
} as const;

// ============================================================================
// Agent Names - Re-export from contracts for convenience
// ============================================================================

export { AGENT_NAMES } from "./agent.js";

// ============================================================================
// Status Emoji
// ============================================================================

export const STATUS_EMOJI = {
    pending: "⏳",
    running: "🔄",
    completed: "✅",
    done: "✅",
    error: "❌",
    timeout: "⏰",
    cancelled: "🚫",
} as const;

export type TaskStatus = keyof typeof STATUS_EMOJI;

// ============================================================================
// Helpers
// ============================================================================

export function getStatusEmoji(status: string): string {
    return STATUS_EMOJI[status as TaskStatus] ?? "❓";
}

