/**
 * File Paths
 */

export const PATHS = {
    OPENCODE: ".opencode",

    // Mission State (Ephemeral)
    MISSION_ROOT: ".opencode/mission",
    TODO: ".opencode/mission/todo.md",
    CONTEXT: ".opencode/mission/context.md",
    SUMMARY: ".opencode/mission/summary.md",
    WORK_LOG: ".opencode/mission/work-log.md",
    STATUS: ".opencode/mission/status.md",
    SYNC_ISSUES: ".opencode/mission/sync-issues.md",
    INTEGRATION_STATUS: ".opencode/mission/integration-status.md",
    UNIT_TESTS: ".opencode/mission/unit-tests",
    TODO_VERSION: ".opencode/mission/todo.version.json",
    VERIFICATION_CHECKLIST: ".opencode/mission/verification-checklist.md",
    ACTIVE_TASKS_LOG: ".opencode/mission/active_tasks.jsonl",

    // Cache & Resources
    CACHE_ROOT: ".opencode/cache",
    DOCS: ".opencode/cache/docs",
    DOC_METADATA: ".opencode/cache/docs/_metadata.json",

    // Archive
    ARCHIVE: ".opencode/archive",
    TASK_ARCHIVE: ".opencode/archive/tasks",
    DOC_ARCHIVE: ".opencode/archive/docs",
    TODO_HISTORY: ".opencode/archive/todo_history.jsonl",

    // Configuration (Static)
    AGENTS_CONFIG: ".opencode/agents.json",
    PLUGINS: ".opencode/plugins",
} as const;

