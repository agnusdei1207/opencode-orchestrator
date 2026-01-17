/**
 * Task Node Interface
 */

import type { ParallelTaskStatus } from "../../../shared/constants.js";

export type TaskStatus = ParallelTaskStatus;

export interface TaskNode {
    id: string;
    description: string;
    level: number;
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
