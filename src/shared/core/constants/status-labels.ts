/**
 * Unified Status Labels
 * 
 * Primitive string values for all status indicators across the system.
 * Casing is standardized to lowercase for consistent internal communication.
 */

export const STATUS_LABEL = {
    // Basic States
    PENDING: "pending",
    RUNNING: "running",
    IN_PROGRESS: "in_progress",

    COMPLETED: "completed",
    DONE: "done",
    SUCCESS: "success",

    // Failure States
    FAILED: "failed",
    ERROR: "error",
    TIMEOUT: "timeout",
    CANCELLED: "cancelled",
    BLOCKED: "blocked",

    // Test/Audit Results
    PASS: "pass",
    FAIL: "fail",
    SKIP: "skip",

    // Quality/Cleanliness
    CLEAN: "clean",
    OK: "ok",
    VERIFIED: "verified",


    // Analysis/Diagnostic
    WARNING: "warning",
    INFO: "info",
    HINT: "hint",
    ALL: "all",
    HIGH: "high",
    MEDIUM: "medium",
    LOW: "low",
} as const;


