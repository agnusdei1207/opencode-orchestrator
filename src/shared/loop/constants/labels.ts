/**
 * Status and Progress Labels for UI and Logging
 */

export const LOOP_LABELS = {
    // Progress
    PROGRESS_PREFIX: "[TODO Progress]:",
    INCOMPLETE_TASKS: "Incomplete Tasks",
    NEXT_TASK: "Next Task",

    // Status Indicators
    STATUS_TITLE: "Status",
    STATUS: {
        RUNNING: "[RUN]",
        WAITING: "[WAIT]",
    },

    // Priority Indicators
    PRIORITY: {
        HIGH: "[H]",
        MEDIUM: "[M]",
        LOW: "[L]",
    },

    // Parallel Dispatch
    PARALLEL_REQUIRED: "[PARALLEL DISPATCH REQUIRED]",
    EXECUTE_NOW: "// EXECUTE NOW - Launch all $COUNT tasks simultaneously:",
    PARALLEL_NOTICE: "NOTICE: Do NOT run these sequentially. Use background=true for ALL.",
    MONITOR_PROGRESS: "After launching, use list_tasks to monitor progress.",

    // Action Required
    ACTION_REQUIRED: "**Action Required**:",
    ACTION_CONTINUE: "1. Continue working on incomplete todos",
    ACTION_MARK_COMPLETE: "2. Mark each task complete when finished",
    ACTION_DONT_STOP: "3. Do NOT stop until all todos are completed or cancelled",

    // Completion
    VERIFIED_COMPLETE: "[Verified Complete]",
    FINAL_STATUS: "**Final Status**:",
    TOTAL_TASKS: "Total Tasks",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    SUCCESS_RATE: "Success Rate",
    MISSION_ACCOMPLISHED: "All tasks have been processed and verified. Mission accomplished!",
} as const;
