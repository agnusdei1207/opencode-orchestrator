/**
 * Shared Module - Central Exports
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
export * from "./os/index.js";
export * from "./verification/index.js";

// Error handling
export * from "./errors/index.js";

// Prompt constants (tags, status)
export * from "./prompt/index.js";

// Re-exports from core modules (for compatibility)
export { TASK_STATUS, TODO_STATUS } from "../core/agents/consts/task-status.const.js";

