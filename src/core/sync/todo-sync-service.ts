
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PluginInput } from "@opencode-ai/plugin";
import { type Todo, TODO_STATUS, PATHS, TASK_STATUS } from "../../shared/index.js";
import { parseTodoMd } from "./todo-parser.js";
import { log } from "../agents/logger.js";

type OpencodeClient = PluginInput["client"];

interface TrackedTaskTodo {
    id: string;
    description: string;
    status: string;
    agent: string;
    isBackground: boolean;
    parentSessionID?: string;
}

export class TodoSyncService {
    private client: OpencodeClient;
    private directory: string;
    private todoPath: string;
    private fileTodos: Todo[] = [];
    private taskTodos: Map<string, TrackedTaskTodo> = new Map();
    private updateTimeout: NodeJS.Timeout | null = null;
    private watcher: fs.FSWatcher | null = null;

    // We only want to sync to the "primary" session or all sessions?
    // The design says `syncTaskStore(sessionID)`.
    // Usually TUI TODO is per session.
    // However, `todo.md` is global (project level).
    // So we should probably broadcast to active sessions or just the one associated with the tasks?
    // Current TUI limitation: we might need to know which session to update.
    // For TUI sidebar, we usually update the session the user is looking at.
    // But we don't know that.
    // We will maintain a set of "active sessions" provided by index.ts or just update relevant ones.
    // For Phase 1, we might just update the sessions we know about (parents of tasks) or register sessions.

    private activeSessions: Set<string> = new Set();

    constructor(client: OpencodeClient, directory: string) {
        this.client = client;
        this.directory = directory;
        this.todoPath = path.join(this.directory, PATHS.TODO);
    }

    async start() {
        // Initial sync
        await this.reloadFileTodos();

        // Watch for file changes
        if (fs.existsSync(this.todoPath)) {
            // throttle watcher
            let timer: NodeJS.Timeout;
            this.watcher = fs.watch(this.todoPath, (eventType) => {
                if (eventType === 'change' || eventType === 'rename') {
                    clearTimeout(timer);
                    timer = setTimeout(() => {
                        this.reloadFileTodos().catch(err => log(`[TodoSync] Error reloading: ${err}`));
                    }, 500);
                }
            });
        }
    }

    registerSession(sessionID: string) {
        this.activeSessions.add(sessionID);
        // Push current state to new session
        this.scheduleUpdate(sessionID);
    }

    unregisterSession(sessionID: string) {
        this.activeSessions.delete(sessionID);
    }

    private async reloadFileTodos() {
        try {
            if (fs.existsSync(this.todoPath)) {
                const content = await fs.promises.readFile(this.todoPath, 'utf-8');
                this.fileTodos = parseTodoMd(content);
                this.broadcastUpdate();
            }
        } catch (error) {
            log(`[TodoSync] Failed to read todo.md: ${error}`);
        }
    }

    /**
     * Called by TaskToastManager when tasks change
     */
    updateTaskStatus(task: TrackedTaskTodo) {
        // Map TaskStatus to TodoStatus logic
        // But here we just store the task info and convert later
        this.taskTodos.set(task.id, task);

        // If task is completed/failed/cancelled and we want to remove it eventually?
        // For now, keep it until explicitly removed (TaskToastManager removes it).

        if (task.parentSessionID) {
            this.scheduleUpdate(task.parentSessionID);
        } else {
            this.broadcastUpdate();
        }
    }

    removeTask(taskId: string) {
        const task = this.taskTodos.get(taskId);
        if (task) {
            this.taskTodos.delete(taskId);
            if (task.parentSessionID) {
                this.scheduleUpdate(task.parentSessionID);
            } else {
                this.broadcastUpdate();
            }
        }
    }

    private broadcastUpdate() {
        for (const sessionID of this.activeSessions) {
            this.scheduleUpdate(sessionID);
        }
    }

    private scheduleUpdate(sessionID: string) {
        // Debounce updates per session could be complex if we track per-session timeouts.
        // For simple Phase 1, just fire and forget or short debounce.
        // Let's do immediate update for responsiveness, but maybe throttle?

        this.sendTodosToSession(sessionID).catch(err => {
            // Ignore errors (session might be closed)
        });
    }

    private async sendTodosToSession(sessionID: string) {
        // Merge File Todos and Task Todos

        // Filter tasks for this session (if we want to scope them)
        // Or show ALL tasks?
        // Usually `todo.md` is global.
        // Tasks are often sub-tasks of the session.
        // Let's show:
        // 1. File Todos (Global)
        // 2. Active Tasks for this session (or all if we want visibility)

        // Design decision: Show tasks related to this session OR all background tasks?
        // Users often want to see what's happening globally.
        // Let's show all tasks for now as "Running Agents".

        const taskTodosList: Todo[] = Array.from(this.taskTodos.values()).map(t => {
            let status: Todo["status"] = "pending";
            // Map task status string to Todo status
            // Runnning -> in_progress
            // Completed -> completed
            // Error -> completed (with error visual?) or keep as in_progress?
            // Todo interface only has: "pending" | "in_progress" | "completed" | "cancelled"

            const s = t.status.toLowerCase();
            if (s.includes("run") || s.includes("wait") || s.includes("que")) status = "in_progress";
            else if (s.includes("complete") || s.includes("done")) status = "completed";
            else if (s.includes("fail") || s.includes("error")) status = "cancelled"; // or completed
            else if (s.includes("cancel")) status = "cancelled";

            return {
                id: `task-${t.id}`, // Prefix to avoid collision
                content: `[${t.agent.toUpperCase()}] ${t.description}`,
                status: status,
                priority: t.isBackground ? "low" : "high",
                createdAt: new Date()
            } as Todo;
        });

        const merged: Todo[] = [
            ...this.fileTodos,
            ...taskTodosList
        ];

        try {
            // Cast to any to bypass potential type mismatch if payload structure differs from type def
            await (this.client.session as any).todo({
                path: { id: sessionID }, // Standardize to id
                body: { todos: merged }
            });
        } catch (error) {
            // Session might be gone
        }
    }

    stop() {
        if (this.watcher) {
            this.watcher.close();
        }
    }
}
