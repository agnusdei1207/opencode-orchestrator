/**
 * Tool constants (consolidated)
 */
import { STATUS_LABEL } from "../core/constants.js";

/**
 * Tool Output Configuration
 */

export const TOOL_OUTPUT = {
    /** Maximum length for healthy output capture */
    MAX_HEALTHY_OUTPUT_LENGTH: 1000,
    /** Threshold for considering output small enough to capture */
    SMALL_OUTPUT_THRESHOLD: 5000,
} as const;

/**
 * Common Tool Languages
 */

export const TOOL_LANG = {
    TS: "ts",
    JS: "js",
    JSON: "json",
    ALL: "*",
} as const;

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
 * Common Tool Sources
 */

export const TOOL_SOURCE = {
    TYPESCRIPT: "typescript",
    ESLINT: "eslint",
    AST_GREP: "ast-grep",
} as const;

/**
 * Common Tool Labels
 */


export const TOOL_LABEL = {
    ERROR: STATUS_LABEL.ERROR,
    WARNING: STATUS_LABEL.WARNING,
    INFO: STATUS_LABEL.INFO,
    HINT: STATUS_LABEL.HINT,
    SUCCESS: STATUS_LABEL.SUCCESS,
    FAILED: STATUS_LABEL.FAILED,
    CLEAN: STATUS_LABEL.CLEAN,
    TIMEOUT: STATUS_LABEL.TIMEOUT,
    DONE: STATUS_LABEL.DONE,
    PENDING: STATUS_LABEL.PENDING,
    RUNNING: STATUS_LABEL.RUNNING,
} as const;


/**
 * LSP Severity Constant
 */

export const LSP_SEVERITY = {
    ERROR: 1,
    WARNING: 2,
    INFO: 3,
    HINT: 4,
} as const;

/**
 * LSP Severity Labels Constant
 */


export const LSP_SEVERITY_LABELS = {
    [LSP_SEVERITY.ERROR]: TOOL_LABEL.ERROR,
    [LSP_SEVERITY.WARNING]: TOOL_LABEL.WARNING,
    [LSP_SEVERITY.INFO]: TOOL_LABEL.INFO,
    [LSP_SEVERITY.HINT]: TOOL_LABEL.HINT,
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

