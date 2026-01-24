/**
 * TodoManager - Legacy Wrapper for the new MVCC-based TodoManager
 */

import { TodoManager as NewTodoManager } from "../todo/todo-manager.js";

/**
 * @deprecated Use src/core/todo/todo-manager.js instead.
 * This class is maintained for partial backward compatibility.
 */
export class TodoManager {
    private static instance: TodoManager;
    private newManager: NewTodoManager;

    private constructor() {
        this.newManager = NewTodoManager.getInstance();
    }

    public static getInstance(): TodoManager {
        if (!TodoManager.instance) {
            TodoManager.instance = new TodoManager();
        }
        return TodoManager.instance;
    }

    public setDirectory(dir: string): void {
        this.newManager.setDirectory(dir);
    }

    /**
     * Update a specific TODO item by its text content
     */
    public async updateItem(searchText: string, newStatus: string): Promise<boolean> {
        return this.newManager.updateItem(searchText, newStatus);
    }

    /**
     * Add a new sub-task under a parent task
     */
    public async addSubTask(parentText: string, subTaskText: string): Promise<boolean> {
        return this.newManager.addSubTask(parentText, subTaskText);
    }
}
