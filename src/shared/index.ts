/**
 * Shared Module - Central Exports
 * 
 * Domain-first organization:
 * - shared/agent/    - AGENT_NAMES, AgentDefinition, AgentName
 * - shared/core/     - TIME, PATHS, ID_PREFIX
 * - shared/task/     - PARALLEL_TASK, ParallelTask, ParallelTaskStatus
 * - shared/loop/     - LOOP, Todo, TodoStatus
 * - shared/notification/ - TOAST_DURATION, ToastMessage, ToastVariant
 * - shared/recovery/ - RECOVERY, ErrorContext, RecoveryAction
 * - shared/cache/    - CACHE, CACHE_ACTIONS
 * - shared/session/  - SESSION_EVENTS, EVENT_TYPES
 * - shared/command/  - BackgroundTask, BackgroundTaskStatus
 * - shared/tool/     - TOOL_NAMES, TOOL_OUTPUT
 * - shared/message/  - PART_TYPES, PROMPTS
 * - shared/errors/   - ERROR_PATTERNS, ERROR_TYPE
 */

// Domain exports
export * from "./agent/index.js";
export * from "./core/index.js";
export * from "./task/index.js";
export * from "./loop/index.js";
export * from "./notification/index.js";
export * from "./recovery/index.js";
export * from "./cache/index.js";
export * from "./session/index.js";
export * from "./command/index.js";
export * from "./tool/index.js";
export * from "./message/index.js";

// Error handling
export * from "./errors/index.js";

// Re-exports from core modules (for compatibility)
export { TASK_STATUS, TODO_STATUS } from "../core/agents/consts/task-status.const.js";
