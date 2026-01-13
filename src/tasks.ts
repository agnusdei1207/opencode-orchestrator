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
    complexity: number; // 1-10
    type: "infrastructure" | "logic" | "integration";
}

export class TaskGraph {
    private tasks: Map<string, Task> = new Map();

    constructor(tasks?: Task[]) {
        if (tasks) {
            tasks.forEach(t => this.addTask(t));
        }
    }

    addTask(task: Task) {
        this.tasks.set(task.id, { ...task, status: "pending", retryCount: 0 });
    }

    getTask(id: string): Task | undefined {
        return this.tasks.get(id);
    }

    updateTask(id: string, updates: Partial<Task>) {
        const task = this.tasks.get(id);
        if (task) {
            this.tasks.set(id, { ...task, ...updates });
        }
    }

    getReadyTasks(): Task[] {
        return Array.from(this.tasks.values()).filter(task => {
            if (task.status !== "pending") return false;
            return task.dependencies.every(depId => {
                const dep = this.tasks.get(depId);
                return dep && dep.status === "completed";
            });
        });
    }

    isCompleted(): boolean {
        return Array.from(this.tasks.values()).every(t => t.status === "completed");
    }

    hasFailed(): boolean {
        return Array.from(this.tasks.values()).some(t => t.status === "failed" && t.retryCount >= 3);
    }

    getTaskSummary(): string {
        const tasks = Array.from(this.tasks.values());
        const completed = tasks.filter(t => t.status === "completed");
        const notCompleted = tasks.filter(t => t.status !== "completed");

        let summary = "📋 **DAG Status**\n";

        // Compact summary for completed tasks to save tokens
        if (completed.length > 0) {
            summary += `✅ Completed: ${completed.length} tasks (Hidden to save tokens)\n`;
        }

        // Detailed view for active/pending tasks
        for (const task of notCompleted) {
            const icon = task.status === "running" ? "⏳" : task.status === "failed" ? "❌" : "💤";
            summary += `${icon} [${task.id}] ${task.description}\n`;
        }

        return summary;
    }

    toJSON(): string {
        return JSON.stringify(Array.from(this.tasks.values()), null, 2);
    }

    static fromJSON(json: string): TaskGraph {
        try {
            const tasks = JSON.parse(json) as Task[];
            return new TaskGraph(tasks);
        } catch (e) {
            console.error("Failed to parse TaskGraph JSON:", e);
            return new TaskGraph();
        }
    }
}
