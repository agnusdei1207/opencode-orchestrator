/**
 * Shared Constants - Index
 * 
 * Re-exports all constants for backward compatibility.
 */

export { TIME } from "./time.js";
export { ID_PREFIX } from "./id-prefix.js";
export { PARALLEL_TASK } from "./parallel-task.js";
export { MEMORY_LIMITS } from "./memory-limits.js";
export { PATHS } from "./paths.js";
export { BACKGROUND_TASK } from "./background-task.js";
export { TOOL_NAMES } from "./tool-names.js";
export { MISSION_SEAL, MISSION } from "./mission-seal.js";
export { SLASH_COMMANDS } from "./slash-commands.js";
export { AGENT_EMOJI, STATUS_EMOJI, getStatusEmoji } from "./status.js";
export type { TaskStatus } from "./status.js";
export { PART_TYPES } from "./part-types.js";
export { PROMPTS } from "./prompts.js";
export { CACHE_ACTIONS } from "./cache-actions.js";
export type { CacheAction } from "./cache-actions.js";
export { BACKGROUND_STATUS } from "./background-status.js";
export type { BackgroundStatus } from "./background-status.js";
export { TOAST_VARIANTS } from "./toast-variants.js";
export { FILTER_STATUS } from "./filter-status.js";
export type { FilterStatus } from "./filter-status.js";

// Re-exports from other shared modules
export { AGENT_NAMES } from "../agent.js";
export { TASK_STATUS, TODO_STATUS } from "../../core/agents/consts/task-status.const.js";
export type { ParallelTaskStatus } from "../../core/agents/types/parallel-task-status.type.js";

