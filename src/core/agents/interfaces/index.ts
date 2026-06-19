/**
 * Agents Interfaces Index
 * Re-exports from shared to maintain compatibility
 */

// Use shared interfaces (consolidated)
export type { ParallelTask } from "../../../shared/task/types.js";
export type { TaskProgress } from "../../../shared/task/types.js";
export type { ConcurrencyConfig } from "../../../shared/agent/index.js";
export type { LaunchInput } from "./launch-input.interface.js";
export type { ResumeInput } from "./resume-input.interface.js";
