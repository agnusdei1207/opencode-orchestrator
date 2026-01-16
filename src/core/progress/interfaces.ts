/**
 * Progress Tracker Interfaces
 */

/**
 * Todo progress data
 */
export interface TodoProgress {
    total: number;
    completed: number;
    pending: number;
    percentage: number;
}

/**
 * Task progress data
 */
export interface TaskProgress {
    total: number;
    running: number;
    completed: number;
    failed: number;
    percentage: number;
}

/**
 * Step progress data
 */
export interface StepProgress {
    current: number;
    max: number;
}

/**
 * Progress snapshot at a point in time
 */
export interface ProgressSnapshot {
    sessionId: string;
    timestamp: Date;
    todos: TodoProgress;
    tasks: TaskProgress;
    steps: StepProgress;
    startedAt: Date;
    elapsedMs: number;
}

/**
 * Input data for recording a snapshot
 */
export interface SnapshotInput {
    todoTotal?: number;
    todoCompleted?: number;
    taskTotal?: number;
    taskRunning?: number;
    taskCompleted?: number;
    taskFailed?: number;
    currentStep?: number;
    maxSteps?: number;
}
