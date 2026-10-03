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
    RUNNING: "[RUNNING]",
    CANCELLED: "[CANCELLED]",
} as const;

/**
 * Parallel Tool Parameter Names
 */

export const PARALLEL_PARAMS = {
    AGENT: "agent",
    PROMPT: "prompt",
    BACKGROUND: "background",
    DESCRIPTION: "description",
    RESUME: "resume",
    MODE: "mode",
    GROUP_ID: "groupID",
    TASK_ID: "taskId",
    STATUS: "status",
} as const;
