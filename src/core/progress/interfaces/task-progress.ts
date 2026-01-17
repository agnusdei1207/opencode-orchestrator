/**
 * Task Progress Interface
 */

export interface TaskProgress {
    total: number;
    running: number;
    completed: number;
    failed: number;
    percentage: number;
}
