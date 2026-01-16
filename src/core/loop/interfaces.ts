/**
 * Todo Enforcer Interfaces
 */

/**
 * Todo item status
 */
export type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

/**
 * Todo item priority
 */
export type TodoPriority = "high" | "medium" | "low";

/**
 * Todo item structure
 */
export interface Todo {
    id: string;
    content: string;
    status: TodoStatus;
    priority: TodoPriority;
    parentId?: string;
    createdAt: Date;
    completedAt?: Date;
}

/**
 * Todo statistics
 */
export interface TodoStats {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    percentComplete: number;
}
