/**
 * ParallelTask Object Pool
 *
 * Reduces GC pressure by reusing ParallelTask objects.
 * Pool size: 200 instances (typical max concurrent tasks)
 */

import { ObjectPool } from "./object-pool.js";
import type { ParallelTask } from "../../shared/task/types.js";
import { TASK_STATUS } from "../../shared/index.js";

interface ParallelTaskPoolInput {
    id: string;
    sessionID: string;
    parentSessionID: string;
    description: string;
    prompt: string;
    agent: string;
    concurrencyKey: string;
    depth: number;
    mode?: ParallelTask["mode"];
    groupID?: string;
}

/**
 * Create a new ParallelTask with reset capability
 */
function createParallelTask(): ParallelTask {
    const task: ParallelTask = {
        id: "",
        sessionID: "",
        parentSessionID: "",
        description: "",
        prompt: "",
        agent: "",
        status: TASK_STATUS.PENDING,
        startedAt: new Date(),
        depth: 0,

        reset() {
            // Reset all fields to initial state
            this.id = "";
            this.sessionID = "";
            this.parentSessionID = "";
            this.description = "";
            this.prompt = "";
            this.agent = "";
            this.status = TASK_STATUS.PENDING;
            this.startedAt = new Date();
            this.completedAt = undefined;
            this.error = undefined;
            this.result = undefined;
            this.concurrencyKey = undefined;
            this.depth = 0;
            this.mode = undefined;
            this.groupID = undefined;
            this.lastMsgCount = undefined;
            this.stablePolls = undefined;
            this.pollFailureCount = undefined;
            this.progress = undefined;
            this.hasStartedOutputting = undefined;
        }
    };

    return task;
}

/**
 * Global ParallelTask pool
 * Pool size: 200 (typical max concurrent tasks)
 */
export const taskPool = new ObjectPool<ParallelTask>(createParallelTask, 200);

// Prewarm with 50 instances for immediate use
taskPool.prewarm(50);

export function acquireParallelTask(input: ParallelTaskPoolInput): ParallelTask {
    const task = taskPool.acquire();
    task.reset();

    task.id = input.id;
    task.sessionID = input.sessionID;
    task.parentSessionID = input.parentSessionID;
    task.description = input.description;
    task.prompt = input.prompt;
    task.agent = input.agent;
    task.status = TASK_STATUS.PENDING;
    task.startedAt = new Date();
    task.completedAt = undefined;
    task.error = undefined;
    task.result = undefined;
    task.concurrencyKey = input.concurrencyKey;
    task.depth = input.depth;
    task.mode = input.mode ?? "normal";
    task.groupID = input.groupID;
    task.lastMsgCount = undefined;
    task.stablePolls = undefined;
    task.pollFailureCount = undefined;
    task.progress = undefined;
    task.hasStartedOutputting = undefined;

    return task;
}
