/**
 * Shared Module - Central Exports
 * Streamlined for Unified Orchestrator Architecture
 */

// Domain exports (Survivors)
export * from "./agent/index.js";
export * from "./core/index.js";
export * from "./task/index.js";
export * from "./cache/index.js";
export * from "./session/index.js";
export * from "./command/index.js";
export * from "./tool/index.js";
export * from "./prompt/index.js";

// Task & Todo Status (Relocated from core/agents/consts)
export { TASK_STATUS, TODO_STATUS } from "./task/constants/task-status.js";

// Re-export specific constants for easier access if needed
export { SESSION_EVENTS } from "./session/index.js";
export { TOOL_NAMES } from "./tool/index.js";
export { AGENT_NAMES } from "./agent/index.js";
export { COMMAND_NAMES } from "./command/index.js";
export { PROMPT_TAGS } from "./prompt/index.js";
