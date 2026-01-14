/**
 * Task management for DAG-based orchestration
 */
export type TaskStatus = "pending" | "running" | "completed" | "failed";
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
    type: "infrastructure" | "logic" | "integration";
}
export declare class TaskGraph {
    private tasks;
    constructor(tasks?: Task[]);
    addTask(task: Task): void;
    getTask(id: string): Task | undefined;
    updateTask(id: string, updates: Partial<Task>): void;
    getReadyTasks(): Task[];
    isCompleted(): boolean;
    hasFailed(): boolean;
    getTaskSummary(): string;
    toJSON(): string;
    static fromJSON(json: string): TaskGraph;
}
