/**
 * Tool constants (consolidated)
 */

/**
 * Formatted Tool Output Labels
 */

export const OUTPUT_LABEL = {
    ERROR: "[ERROR]",
    WARNING: "[WARNING]",
    INFO: "[INFO]",
    DONE: "[DONE]",
    OK: "[OK]",
    SPAWNED: "[SPAWNED]",
    RESUME: "[RESUME]",
    TIMEOUT: "[TIMEOUT]",
    RUNNING: "[RUNNING]",
    CANCELLED: "[CANCELLED]",
    RESUMED_DONE: "[RESUMED & DONE]",
    SYNC_START: "[SYNC START]",
    CACHED: "[CACHED]",
    JSON_FETCHED: "[JSON FETCHED]",
    TEXT_FETCHED: "[TEXT FETCHED]",
} as const;

/**
 * Parallel Tool Logging Constants
 */

export const PARALLEL_LOG = {
    DELEGATE_TASK: "[delegate-task]",
} as const;

/**
 * Parallel Tool Parameter Names
 */

export const PARALLEL_PARAMS = {
    AGENT: "agent",
    TASK: "task",
    PROMPT: "prompt",
    CONTEXT: "context",
    BACKGROUND: "background",
    PARALLEL_GROUP: "parallel_group",
    RETRY: "retry",
    TIMEOUT: "timeout",
    DESCRIPTION: "description",
    RESUME: "resume",
    MODE: "mode",
    GROUP_ID: "groupID",
    TASK_ID: "taskId",
    STATUS: "status",
} as const;

