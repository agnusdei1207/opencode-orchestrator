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
    SED_REPLACE: "sed_replace",
    // Diff & Compare tools
    DIFF: "diff",
    // JSON tools
    JQ: "jq",
    // HTTP tools
    HTTP: "http",
    // File tools
    FILE_STATS: "file_stats",
    // Git tools
    GIT_DIFF: "git_diff",
    GIT_STATUS: "git_status",
    // Web tools
    WEBFETCH: "webfetch",
    WEBSEARCH: "websearch",
    CODESEARCH: "codesearch",
    CACHE_DOCS: "cache_docs",
    // Other tools
    CALL_AGENT: "call_agent",
    SLASHCOMMAND: "slashcommand",
} as const;
