/**
 * Task Progress Interface
 */

export interface TaskProgress {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    percentage: number;
}
