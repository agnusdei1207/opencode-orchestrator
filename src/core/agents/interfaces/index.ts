/**
 * Agents Interfaces Index
 * Re-exports from shared to maintain compatibility
 */

// Use shared interfaces (consolidated)
export type { ParallelTask } from "../../../shared/task/interfaces/parallel-task.js";
export type { TaskProgress } from "../../../shared/task/interfaces/task-progress.js";
export type { ConcurrencyConfig } from "../../../shared/agent/interfaces/concurrency-config.js";
export type { LaunchInput } from "./launch-input.interface.js";
export type { ResumeInput } from "./resume-input.interface.js";
