/**
 * Todo Interface
 */

import type { TodoStatus, TodoPriority } from "../types/index.js";

export interface Todo {
    id: string;
    content: string;
    status: TodoStatus;
    priority: TodoPriority;
    parentId?: string;
    createdAt: Date;
    completedAt?: Date;
}
