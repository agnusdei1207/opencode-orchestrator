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

    // Research/documentation confidence level
    CONFIDENCE: {
        HIGH: "HIGH",      // Official documentation
        MEDIUM: "MEDIUM",  // GitHub, verified sources
        LOW: "LOW",        // Blog posts, unverified
    },

    // Session state
    SESSION: {
        STARTED: "STARTED",
        COMPLETED: "COMPLETED",
        CANCELLED: "CANCELLED",
    },

    // Task triage - complexity classification
    TRIAGE: {
        TYPE: {
            SIMPLE: "Simple",
            MEDIUM: "Medium",
            COMPLEX: "Complex",
        },
        SIGNAL: {
            ONE_FILE: "One file",
            MULTI_FILE: "Multi-file",
            LARGE_SCOPE: "Large scope",
        },
        APPROACH: {
            DIRECT: "Direct action",
            PLAN_EXECUTE_VERIFY: "Plan - Execute - Verify",
            RESEARCH_PLAN_PARALLEL: "Research - Plan - Parallel Execute",
        },
    },

    // TODO.md status values (for Epic/Task display)
    TODO_STATUS: {
        PENDING: "pending",
        IN_PROGRESS: "in-progress",
        COMPLETE: "COMPLETE",
        BLOCKED: "blocked",
        DONE: "DONE",
    },

    // Task size estimation
    TASK_SIZE: {
        XS: "XS",   // <5min
        S: "S",     // 5-15min
        M: "M",     // 15-30min
        L: "L",     // 30-60min
    },
} as const;

