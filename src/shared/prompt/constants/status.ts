/**
 * Work Status Constants
 * 
 * All status values used in work-log.md, todo.md, sync-issues.md, status.md.
 */

import { STATUS_LABEL } from "../../core/constants/status-labels.js";

export const WORK_STATUS = {
    // File action types
    ACTION: {
        CREATE: "CREATE",
        MODIFY: "MODIFY",
        DELETE: "DELETE",
        FIX: "FIX",
    },

    // Task/file status (Internal state)
    STATUS: {
        PENDING: STATUS_LABEL.PENDING,
        IN_PROGRESS: STATUS_LABEL.IN_PROGRESS,
        DONE: STATUS_LABEL.DONE,
        FAILED: STATUS_LABEL.FAILED,
    },

    // Test result
    TEST_RESULT: {
        PASS: STATUS_LABEL.PASS,
        FAIL: STATUS_LABEL.FAIL,
        SKIP: STATUS_LABEL.SKIP,
    },

    // E2E integration test status
    E2E_STATUS: {
        NOT_STARTED: "NOT_STARTED",
        RUNNING: STATUS_LABEL.RUNNING,
        PASS: STATUS_LABEL.PASS,
        FAIL: STATUS_LABEL.FAIL,
    },

    // Mission phase
    PHASE: {
        PLANNING: "PLANNING",
        IMPLEMENTATION: "IMPLEMENTATION",
        E2E: "E2E",
        FIXING: "FIXING",
        VERIFYING: "VERIFYING",
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
        STARTED: STATUS_LABEL.PENDING, // Standardized mapping
        COMPLETED: STATUS_LABEL.DONE,
        CANCELLED: STATUS_LABEL.CANCELLED,
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
        PENDING: STATUS_LABEL.PENDING,
        IN_PROGRESS: STATUS_LABEL.IN_PROGRESS,
        COMPLETE: STATUS_LABEL.COMPLETED,
        BLOCKED: STATUS_LABEL.BLOCKED,
        DONE: STATUS_LABEL.DONE,
        VERIFIED: STATUS_LABEL.VERIFIED,
    },


    // Task size estimation
    TASK_SIZE: {
        XS: "XS",   // <10min
        S: "S",     // 10-20min
        M: "M",     // 20-40min
        L: "L",     // 40-60min
    },
} as const;



