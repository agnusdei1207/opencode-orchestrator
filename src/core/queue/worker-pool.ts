/**
 * Work-Stealing Worker Pool
 *
 * High-performance worker pool using Chase-Lev work-stealing deques.
 * - Each worker has its own deque
 * - Workers steal from each other when idle
 * - LIFO for owner (cache locality)
 * - FIFO for thieves (fairness)
 *
 * Target: 90%+ CPU utilization, 2-3x throughput
 */

import { WorkStealingDeque, WorkItem } from "./work-stealing-deque.js";
import { TaskPriority } from "../agents/concurrency.js";
import { log } from "../agents/logger.js";

type WorkExecutor<T> = (item: WorkItem<T>) => Promise<void>;

/**
 * Work-Stealing Worker Pool
 */
export class WorkStealingWorkerPool<T> {
    private workers: Map<string, WorkStealingDeque<T>> = new Map();
    private workerIds: string[] = [];
    private executor: WorkExecutor<T>;
    private running: boolean = false;
    private workerPromises: Promise<void>[] = [];
    private workerLoops: Map<string, boolean> = new Map();

    // Adaptive waiting
    private minWaitMs = 1;
    private maxWaitMs = 100;
    private currentWaitMs = 10;

    // Statistics
    private stats = {
        totalExecuted: 0,
        totalStolen: 0,
        idleTime: 0,
        busyTime: 0
    };

    constructor(
        workerCount: number,
        executor: WorkExecutor<T>
    ) {
        this.executor = executor;

        // Create workers
        for (let i = 0; i < workerCount; i++) {
            const workerId = `worker-${i}`;
            this.workers.set(workerId, new WorkStealingDeque<T>());
            this.workerIds.push(workerId);
            this.workerLoops.set(workerId, false);
        }
    }

    /**
     * Start the worker pool
     */
    start(): void {
        if (this.running) return;

        this.running = true;
        this.workerPromises = this.workerIds.map(id => this.workerLoop(id));
        log(`[WorkerPool] Started with ${this.workerIds.length} workers`);
    }

    /**
     * Submit work to the pool
     * @param item - Work item to execute
     * @param priority - Task priority
     * @param targetWorker - Optional specific worker (for affinity)
     */
    submit(item: T, priority: TaskPriority = TaskPriority.NORMAL, targetWorker?: string): void {
        const workerId = targetWorker || this.getLeastLoadedWorker();
        const deque = this.workers.get(workerId);

        if (!deque) {
            throw new Error(`Worker ${workerId} not found`);
        }

        deque.push({
            task: item,
            priority,
            enqueuedAt: Date.now()
        });
    }

    /**
     * Worker loop - executes tasks and steals when idle
     */
    private async workerLoop(workerId: string): Promise<void> {
        const deque = this.workers.get(workerId)!;
        this.workerLoops.set(workerId, true);

        while (this.running && this.workerLoops.get(workerId)) {
            let workItem: WorkItem<T> | null = null;

            // 1. Try own queue (LIFO for cache locality)
            workItem = deque.pop();

            if (workItem) {
                // Execute work
                const startTime = Date.now();
                try {
                    await this.executor(workItem);
                    this.stats.totalExecuted++;
                    this.stats.busyTime += Date.now() - startTime;
                } catch (error) {
                    log(`[WorkerPool] ${workerId} execution error: ${error}`);
                }

                // Reset wait time on successful work
                this.currentWaitMs = this.minWaitMs;
                continue;
            }

            // 2. Try stealing from other workers (FIFO for fairness)
            workItem = this.trySteal(workerId);

            if (workItem) {
                // Execute stolen work
                const startTime = Date.now();
                try {
                    await this.executor(workItem);
                    this.stats.totalExecuted++;
                    this.stats.totalStolen++;
                    this.stats.busyTime += Date.now() - startTime;
                } catch (error) {
                    log(`[WorkerPool] ${workerId} execution error (stolen): ${error}`);
                }

                // Reset wait time on successful steal
                this.currentWaitMs = this.minWaitMs;
                continue;
            }

            // 3. Idle - adaptive wait
            const idleStart = Date.now();
            await this.adaptiveWait();
            this.stats.idleTime += Date.now() - idleStart;
        }
    }

    /**
     * Try to steal work from other workers
     */
    private trySteal(thiefId: string): WorkItem<T> | null {
        // Random start index for fairness
        const startIdx = Math.floor(Math.random() * this.workerIds.length);

        for (let i = 0; i < this.workerIds.length; i++) {
            const victimIdx = (startIdx + i) % this.workerIds.length;
            const victimId = this.workerIds[victimIdx];

            // Don't steal from yourself
            if (victimId === thiefId) continue;

            const victimDeque = this.workers.get(victimId);
            if (!victimDeque) continue;

            const stolen = victimDeque.steal();
            if (stolen) {
                return stolen;
            }
        }

        return null;
    }

    /**
     * Adaptive waiting when idle
     * Exponential backoff: 1ms -> 100ms
     */
    private async adaptiveWait(): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, this.currentWaitMs));

        // Exponential backoff
        this.currentWaitMs = Math.min(
            this.currentWaitMs * 1.5,
            this.maxWaitMs
        );
    }

    /**
     * Get least loaded worker
     */
    private getLeastLoadedWorker(): string {
        let minLoad = Infinity;
        let leastLoadedId = this.workerIds[0];

        for (const workerId of this.workerIds) {
            const deque = this.workers.get(workerId)!;
            const load = deque.size();

            if (load < minLoad) {
                minLoad = load;
                leastLoadedId = workerId;
            }
        }

        return leastLoadedId;
    }

    /**
     * Stop the worker pool
     */
    async stop(): Promise<void> {
        this.running = false;

        // Stop all worker loops
        for (const workerId of this.workerIds) {
            this.workerLoops.set(workerId, false);
        }

        // Wait for all workers to finish
        await Promise.all(this.workerPromises);

        log(`[WorkerPool] Stopped. Stats: ${JSON.stringify(this.getStats())}`);
    }

    /**
     * Get pool statistics
     */
    getStats(): {
        workers: number;
        totalExecuted: number;
        totalStolen: number;
        stealRate: number;
        utilizationPercent: number;
        queuedTasks: number;
    } {
        const totalTime = this.stats.busyTime + this.stats.idleTime;
        const utilization = totalTime > 0 ? (this.stats.busyTime / totalTime) * 100 : 0;
        const stealRate = this.stats.totalExecuted > 0
            ? (this.stats.totalStolen / this.stats.totalExecuted) * 100
            : 0;

        let queuedTasks = 0;
        for (const deque of this.workers.values()) {
            queuedTasks += deque.size();
        }

        return {
            workers: this.workerIds.length,
            totalExecuted: this.stats.totalExecuted,
            totalStolen: this.stats.totalStolen,
            stealRate: Math.round(stealRate * 100) / 100,
            utilizationPercent: Math.round(utilization * 100) / 100,
            queuedTasks
        };
    }

    /**
     * Get total queued tasks across all workers
     */
    getQueuedCount(): number {
        let total = 0;
        for (const deque of this.workers.values()) {
            total += deque.size();
        }
        return total;
    }
}
