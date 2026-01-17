/**
 * Snapshot Input Interface
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
