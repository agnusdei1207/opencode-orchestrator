/**
 * Task WAL (Write-Ahead Log) - Optimized for reduced I/O
 * 
 * Uses buffered writes to minimize file I/O overhead.
 * Only flushes on critical events or periodic intervals.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { WAL_ACTIONS } from "../../../shared/index.js";
import type { ParallelTask } from "../interfaces/parallel-task.interface.js";

export interface WALEntry {
    timestamp: string;
    action: keyof typeof WAL_ACTIONS;
    taskId: string;
    data: Partial<ParallelTask>;
}

export class TaskWAL {
    private walPath: string;
    private initialized = false;
    private buffer: WALEntry[] = [];
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly FLUSH_INTERVAL = 5000; // Flush every 5 seconds
    private readonly MAX_BUFFER_SIZE = 20; // Or when buffer exceeds 20 entries

    constructor(customPath?: string) {
        this.walPath = customPath || path.resolve(process.cwd(), ".opencode/archive/tasks/active_tasks.jsonl");
    }

    async init(): Promise<void> {
        if (this.initialized) return;
        try {
            const dir = path.dirname(this.walPath);
            await fs.mkdir(dir, { recursive: true });
            this.initialized = true;
        } catch {
            // Silent fail - WAL is best effort
        }
    }

    async log(action: WALEntry["action"], task: ParallelTask): Promise<void> {
        if (!this.initialized) await this.init();

        const entry: WALEntry = {
            timestamp: new Date().toISOString(),
            action,
            taskId: task.id,
            data: action === WAL_ACTIONS.DELETE ? { id: task.id } : {
                id: task.id,
                sessionID: task.sessionID,
                parentSessionID: task.parentSessionID,
                description: task.description,
                agent: task.agent,
                status: task.status,
                startedAt: task.startedAt,
                depth: task.depth,
                prompt: action === WAL_ACTIONS.LAUNCH ? task.prompt : undefined,
            },
        };

        this.buffer.push(entry);

        // Flush immediately on critical actions or when buffer is full
        if (action === WAL_ACTIONS.LAUNCH || action === WAL_ACTIONS.DELETE || this.buffer.length >= this.MAX_BUFFER_SIZE) {
            await this.flush();
        } else {
            this.scheduleFlush();
        }
    }

    private scheduleFlush(): void {
        if (this.flushTimer) return;
        this.flushTimer = setTimeout(() => {
            this.flush().catch(() => { });
        }, this.FLUSH_INTERVAL);
    }

    async flush(): Promise<void> {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        if (this.buffer.length === 0) return;

        const entries = this.buffer;
        this.buffer = [];

        try {
            const content = entries.map(e => JSON.stringify(e)).join("\n") + "\n";
            await fs.appendFile(this.walPath, content);
        } catch {
            // Best effort - re-add to buffer on failure
            this.buffer = [...entries, ...this.buffer];
        }
    }

    async readAll(): Promise<Map<string, ParallelTask>> {
        if (!this.initialized) await this.init();

        // Flush any pending writes before reading
        await this.flush();

        const tasks = new Map<string, ParallelTask>();
        try {
            const content = await fs.readFile(this.walPath, "utf-8");
            const lines = content.split("\n").filter(Boolean);

            for (const line of lines) {
                try {
                    const entry: WALEntry = JSON.parse(line);
                    if (entry.action === WAL_ACTIONS.DELETE) {
                        tasks.delete(entry.taskId);
                    } else if (entry.action === WAL_ACTIONS.LAUNCH) {
                        tasks.set(entry.taskId, entry.data as ParallelTask);
                    } else {
                        const existing = tasks.get(entry.taskId);
                        if (existing) {
                            Object.assign(existing, entry.data);
                        }
                    }
                } catch {
                    // Skip corrupt lines
                }
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                // Silent fail
            }
        }
        return tasks;
    }

    async compact(activeTasks: ParallelTask[]): Promise<void> {
        // Flush buffer first
        await this.flush();

        if (activeTasks.length === 0) {
            // Clear WAL if no active tasks
            try {
                await fs.writeFile(this.walPath, "");
            } catch {
                // Silent fail
            }
            return;
        }

        try {
            const tempPath = `${this.walPath}.tmp`;
            const content = activeTasks.map(task => JSON.stringify({
                timestamp: new Date().toISOString(),
                action: WAL_ACTIONS.LAUNCH,
                taskId: task.id,
                data: task,
            } as WALEntry)).join("\n") + "\n";

            await fs.writeFile(tempPath, content);
            await fs.rename(tempPath, this.walPath);
        } catch {
            // Silent fail
        }
    }
}

export const taskWAL = new TaskWAL();

