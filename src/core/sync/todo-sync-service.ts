
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PluginInput } from "@opencode-ai/plugin";
import { type Todo, TODO_STATUS, PATHS, TASK_STATUS, STATUS_LABEL, TODO_CONSTANTS } from "../../shared/index.js";
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
        this.taskTodos.set(task.id, task);
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
        // Debounce updates per session (simplified for now)
        this.sendTodosToSession(sessionID).catch(err => {
            // Ignore errors (session might be closed)
        });
    }

    private async sendTodosToSession(sessionID: string) {
        // Merge File Todos and Task Todos
        const taskTodosList: Todo[] = Array.from(this.taskTodos.values()).map(t => {
            let status: Todo["status"] = TODO_STATUS.PENDING;


            const s = t.status.toLowerCase();
            if (s.includes(STATUS_LABEL.RUNNING) || s.includes("wait") || s.includes("que")) status = TODO_STATUS.IN_PROGRESS;
            else if (s.includes(STATUS_LABEL.COMPLETED) || s.includes(STATUS_LABEL.DONE)) status = TODO_STATUS.COMPLETED;
            else if (s.includes(STATUS_LABEL.FAILED) || s.includes(STATUS_LABEL.ERROR)) status = TODO_STATUS.CANCELLED; // or completed
            else if (s.includes(STATUS_LABEL.CANCELLED)) status = TODO_STATUS.CANCELLED;

            return {
                id: `${TODO_CONSTANTS.PREFIX.TASK}${t.id}`, // Prefix to avoid collision
                content: `[${t.agent.toUpperCase()}] ${t.description}`,
                status: status,
                priority: t.isBackground ? STATUS_LABEL.LOW as Todo["priority"] : STATUS_LABEL.HIGH as Todo["priority"],
                createdAt: new Date()
            } as Todo;
        });

        const merged: Todo[] = [
            ...this.fileTodos,
            ...taskTodosList
        ];

        // Strictly adhere to OpenCode Todo.Info schema: { id, content, status, priority }
        const payloadTodos = merged.map(todo => ({
            id: todo.id,
            content: todo.content,
            status: todo.status,
            priority: todo.priority
        }));

        try {
            // Cast to any to bypass potential type mismatch if payload structure differs from type def
            await (this.client.session as any).todo({
                path: { id: sessionID }, // Standardize to id
                body: { todos: payloadTodos }
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
