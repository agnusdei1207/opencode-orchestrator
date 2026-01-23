import { TOOL_NAMES } from "../../tool/constants/tool-names.js";

export const MEMORY_CONSTANTS = {
    ID_PREFIX: "mem_",
    LEVELS: {
        SYSTEM: "system",
        PROJECT: "project",
        MISSION: "mission",
        TASK: "task",
    },
    IMPORTANCE: {
        LOW: 0.3,
        NORMAL: 0.5,
        HIGH: 0.7,
        CRITICAL: 0.9,
    },
    // Tools that produce high volume or irrelevant output for memory
    NOISY_TOOLS: [
        TOOL_NAMES.LIST_TASKS,
        TOOL_NAMES.GET_TASK_RESULT,
        TOOL_NAMES.LIST_BACKGROUND,
        TOOL_NAMES.CHECK_BACKGROUND,
        TOOL_NAMES.LIST_AGENTS,
        TOOL_NAMES.SHOW_METRICS
    ] as string[],
    // Significant keywords for memory promotion
    KEYWORDS: {
        DONE: "DONE",
        SUCCESS: "SUCCESS",
        ERROR: "ERROR",
        FAIL: "FAIL",
    },
    MAX_CONTENT_LENGTH: 1000,
} as const;

export const HOOK_NAMES = {
    MEMORY_GATE: "MemoryGate",
    METRICS_TELEMETRY: "MetricsTelemetry",
    SANITY_CHECK: "SanityCheck",
    MISSION_LOOP: "MissionLoop",
    MISSION_CONTROL: "MissionControl",
    STRICT_ROLE_GUARD: "StrictRoleGuard",
    SECRET_SCANNER: "SecretScanner",
    AGENT_UI: "AgentUI",
    RESOURCE_CONTROL: "ResourceControl",
    USER_ACTIVITY: "UserActivity",
    SLASH_COMMAND: "SlashCommandDispatcher",
} as const;

export const TODO_CONSTANTS = {
    MARKERS: {
        PENDING: "[ ]",
        COMPLETED: "[x]",
        PROGRESS: "[/]",
        FAILED: "[-]",
    },
    STATUS: {
        PENDING: "pending",
        COMPLETED: "completed",
        PROGRESS: "progress",
        FAILED: "failed",
    }
} as const;

export const TUI_CONSTANTS = {
    BAR_WIDTH: 30,
    COLORS: {
        PROGRESS: "\x1b[36m",
        AGENT: "\x1b[32m",
        RESET: "\x1b[0m",
        BOLD: "\x1b[1m",
        DIM: "\x1b[2m",
    },
    LABELS: {
        IDLE: "Idle",
        WAITING: "Waiting for tasks...",
        PROGRESS_TITLE: "MISSION PROGRESS",
        AGENT_TITLE: "ACTIVE AGENTS",
    }
} as const;
