/**
 * Work Status Constants
 * 
 * All status values used in work-log.md, todo.md, sync-issues.md, status.md.
 */

export const WORK_STATUS = {
    // File action types
    ACTION: {
        CREATE: "CREATE",
        MODIFY: "MODIFY",
        DELETE: "DELETE",
        FIX: "FIX",
    },

    // Task/file status
    STATUS: {
        PENDING: "PENDING",
        IN_PROGRESS: "IN_PROGRESS",
        DONE: "DONE",
        FAILED: "FAILED",
    },

    // Test result
    TEST_RESULT: {
        PASS: "PASS",
        FAIL: "FAIL",
        SKIP: "SKIP",
    },

    // E2E integration test status
    E2E_STATUS: {
        NOT_STARTED: "NOT_STARTED",
        RUNNING: "RUNNING",
        PASS: "PASS",
        FAIL: "FAIL",
    },

    // Mission phase
    PHASE: {
        PLANNING: "PLANNING",
        IMPLEMENTATION: "IMPLEMENTATION",
        E2E: "E2E",
        FIXING: "FIXING",
        SEALING: "SEALING",
    },

    // Issue severity  
    SEVERITY: {
        HIGH: "HIGH",
        MEDIUM: "MEDIUM",
        LOW: "LOW",
    },

    // Session state
    SESSION: {
        STARTED: "STARTED",
        COMPLETED: "COMPLETED",
        CANCELLED: "CANCELLED",
    },
} as const;

