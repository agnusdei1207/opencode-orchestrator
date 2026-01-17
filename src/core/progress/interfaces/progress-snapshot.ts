/**
 * Progress Snapshot Interface
 */

import type { TodoProgress } from "./todo-progress.js";
import type { TaskProgress } from "./task-progress.js";
import type { StepProgress } from "./step-progress.js";

export interface ProgressSnapshot {
    sessionId: string;
    timestamp: Date;
    todos: TodoProgress;
    tasks: TaskProgress;
    steps: StepProgress;
    startedAt: Date;
    elapsedMs: number;
}
