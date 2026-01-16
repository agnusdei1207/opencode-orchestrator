/**
 * Task Decomposer Interfaces
 */

import { TASK_STATUS, ParallelTaskStatus } from "../../shared/constants.js";

// Re-export for convenience
export { TASK_STATUS };
export type TaskStatus = ParallelTaskStatus;

/**
 * Single task node
 */
export interface TaskNode {
    id: string;
    description: string;
    level: number;  // 0=root, 1, 2, 3
    parent?: string;
    children: string[];
    status: TaskStatus;
    agent?: string;
    parallelGroup?: string;
    dependsOn: string[];
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    result?: string;
}

/**
 * Complete task hierarchy
 */
export interface TaskHierarchy {
    rootId: string;
    nodes: Map<string, TaskNode>;
    parallelGroups: Map<string, string[]>;
}

/**
 * Task progress statistics
 */
export interface TaskProgress {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    percentage: number;
}

/**
 * Task creation input
 */
export interface TaskInput {
    description: string;
    level: number;
    parentId?: string;
    agent?: string;
    parallelGroup?: string;
    dependsOn?: string[];
}
