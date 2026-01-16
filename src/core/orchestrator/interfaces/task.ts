/**
 * Task - A single task in the orchestration DAG
 */
import { TaskStatus } from "../types/task-status.js";
import { TaskType } from "../types/task-type.js";

export interface Task {
    id: string;
    description: string;
    action: string;
    file: string;
    dependencies: string[];
    status: TaskStatus;
    result?: string;
    retryCount: number;
    complexity: number;
    type: TaskType;
}
