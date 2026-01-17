/**
 * Tool Names
 */

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
    // Web tools
    WEBFETCH: "webfetch",
    WEBSEARCH: "websearch",
    CODESEARCH: "codesearch",
    CACHE_DOCS: "cache_docs",
    // Other tools
    CALL_AGENT: "call_agent",
    SLASHCOMMAND: "slashcommand",
} as const;
