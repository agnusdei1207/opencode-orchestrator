/**
 * File Paths
 */

export const PATHS = {
    OPENCODE: ".opencode",
    DOCS: ".opencode/docs",
    ARCHIVE: ".opencode/archive",
    TASK_ARCHIVE: ".opencode/archive/tasks",
    DOC_ARCHIVE: ".opencode/archive/docs",
    TODO: ".opencode/todo.md",
    CONTEXT: ".opencode/context.md",
    SUMMARY: ".opencode/summary.md",
    DOC_METADATA: ".opencode/docs/_metadata.json",
    // TDD & Parallel Work State
    WORK_LOG: ".opencode/work-log.md",
    UNIT_TESTS: ".opencode/unit-tests",
    SYNC_ISSUES: ".opencode/sync-issues.md",
    INTEGRATION_STATUS: ".opencode/integration-status.md",
    // Progress tracking
    STATUS: ".opencode/status.md",
    // Configuration
    AGENTS_CONFIG: ".opencode/agents.json",
    PLUGINS: ".opencode/plugins",
} as const;

