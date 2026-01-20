/**
 * Task WAL (Write-Ahead Log)
 * 
 * Handles append-only logging of task state transitions for crash recovery.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { PATHS, WAL_ACTIONS } from "../../../shared/index.js";
import { log } from "../logger.js";
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

    constructor(customPath?: string) {
        this.walPath = customPath || path.resolve(process.cwd(), ".opencode/archive/tasks/active_tasks.jsonl");
    }

    async init(): Promise<void> {
        if (this.initialized) return;
        try {
            const dir = path.dirname(this.walPath);
            await fs.mkdir(dir, { recursive: true });
            this.initialized = true;
        } catch (error) {
            log("Failed to initialize Task WAL directory:", error);
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
                prompt: action === WAL_ACTIONS.LAUNCH ? task.prompt : undefined, // Only log prompt on launch to save space
            },
        };

        try {
            await fs.appendFile(this.walPath, JSON.stringify(entry) + "\n");
        } catch (error) {
            // Best effort logging
        }
    }

    async readAll(): Promise<Map<string, ParallelTask>> {
        if (!this.initialized) await this.init();

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
            if ((error as any).code !== "ENOENT") {
                log("Error reading Task WAL:", error);
            }
        }
        return tasks;
    }

    /**
     * Compact the WAL by writing only the current active tasks
     */
    async compact(activeTasks: ParallelTask[]): Promise<void> {
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
        } catch (error) {
            log("Failed to compact Task WAL:", error);
        }
    }
}

export const taskWAL = new TaskWAL();
