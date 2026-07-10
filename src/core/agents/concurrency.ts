/**
 * Enhanced Concurrency Controller
 *
 * Queue-based rate limiting with:
 * - Priority queue (HIGH/NORMAL/LOW)
 * - Circuit breaker pattern
 * - Resource-aware scheduling
 * - Adaptive auto-scaling
 */

import { PARALLEL_TASK } from "../../shared/index.js";
import type { ConcurrencyConfig } from "../../shared/agent/index.js";
import { ConcurrencyToken } from "./concurrency-token.js";
import { WorkStealingWorkerPool } from "../queue/worker-pool.js";
import type { WorkItem } from "../queue/work-stealing-deque.js";

export type { ConcurrencyConfig } from "../../shared/agent/index.js";

export enum TaskPriority {
    HIGH = 0,
    NORMAL = 1,
    LOW = 2
}

export enum CircuitState {
    CLOSED = "CLOSED",     // Normal operation
    OPEN = "OPEN",         // Blocking requests
    HALF_OPEN = "HALF_OPEN" // Testing recovery
}

interface QueuedTask {
    resolve: () => void;
    reject: (error: Error) => void;
    timeoutId: NodeJS.Timeout;
    priority: TaskPriority;
    enqueuedAt: number;
}

interface CircuitBreaker {
    state: CircuitState;
    failureCount: number;
    lastFailureTime: number;
    successCount: number;  // For half-open testing
}

const DEFAULT_ACQUISITION_TIMEOUT_MS = 300_000;
const DEFAULT_CIRCUIT_FAILURE_THRESHOLD = 5;
const DEFAULT_CIRCUIT_RECOVERY_TIMEOUT_MS = 30_000;
const DEFAULT_HALF_OPEN_SUCCESS_THRESHOLD = 2;
const DEFAULT_RESOURCE_PRESSURE_MAX_HEAP_PERCENT = 80;

export interface ResourcePressureStatus {
    underPressure: boolean;
    heapUsed: number;
    heapTotal: number;
    heapPercent: number;
    maxHeapPercent: number;
}

function normalizeLimit(limit: number): number {
    return limit === 0 ? Infinity : limit;
}

function assertValidLimit(name: string, limit: number): number {
    if (!Number.isInteger(limit) || limit < 0) {
        throw new Error(`${name} must be a non-negative integer, got ${limit}`);
    }
    return limit;
}

function assertPositiveInteger(name: string, value: number): number {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`${name} must be a positive integer, got ${value}`);
    }
    return value;
}

function assertPercentage(name: string, value: number): number {
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
        throw new Error(`${name} must be a percentage between 0 and 100, got ${value}`);
    }
    return value;
}

function normalizeLimitMap(name: string, limits?: Record<string, number>): Record<string, number> | undefined {
    if (!limits) return undefined;

    const normalized: Record<string, number> = {};
    for (const [key, limit] of Object.entries(limits)) {
        normalized[key] = assertValidLimit(`${name}.${key}`, limit);
    }
    return normalized;
}

function normalizePositiveIntegerMap(name: string, counts?: Record<string, number>): Record<string, number> | undefined {
    if (!counts) return undefined;

    const normalized: Record<string, number> = {};
    for (const [key, count] of Object.entries(counts)) {
        normalized[key] = assertPositiveInteger(`${name}.${key}`, count);
    }
    return normalized;
}

function normalizeConfig(config: ConcurrencyConfig = {}): ConcurrencyConfig {
    return {
        defaultConcurrency: config.defaultConcurrency === undefined
            ? undefined
            : assertValidLimit("defaultConcurrency", config.defaultConcurrency),
        acquisitionTimeoutMs: config.acquisitionTimeoutMs === undefined
            ? undefined
            : assertPositiveInteger("acquisitionTimeoutMs", config.acquisitionTimeoutMs),
        circuitFailureThreshold: config.circuitFailureThreshold === undefined
            ? undefined
            : assertPositiveInteger("circuitFailureThreshold", config.circuitFailureThreshold),
        circuitRecoveryTimeoutMs: config.circuitRecoveryTimeoutMs === undefined
            ? undefined
            : assertPositiveInteger("circuitRecoveryTimeoutMs", config.circuitRecoveryTimeoutMs),
        halfOpenSuccessThreshold: config.halfOpenSuccessThreshold === undefined
            ? undefined
            : assertPositiveInteger("halfOpenSuccessThreshold", config.halfOpenSuccessThreshold),
        resourcePressureMaxHeapPercent: config.resourcePressureMaxHeapPercent === undefined
            ? undefined
            : assertPercentage("resourcePressureMaxHeapPercent", config.resourcePressureMaxHeapPercent),
        workStealingWorkers: normalizePositiveIntegerMap("workStealingWorkers", config.workStealingWorkers),
        agentConcurrency: normalizeLimitMap("agentConcurrency", config.agentConcurrency),
        providerConcurrency: normalizeLimitMap("providerConcurrency", config.providerConcurrency),
        modelConcurrency: normalizeLimitMap("modelConcurrency", config.modelConcurrency),
    };
}

export class ConcurrencyController {
    private counts: Map<string, number> = new Map();
    private queues: Map<string, QueuedTask[]> = new Map();
    private limits: Map<string, number> = new Map();
    private config: ConcurrencyConfig;

    // Auto-scaling metrics
    private successStreak: Map<string, number> = new Map();
    private failureCount: Map<string, number> = new Map();

    // Circuit breaker
    private circuits: Map<string, CircuitBreaker> = new Map();
    private activeTokens: Set<ConcurrencyToken> = new Set();

    // Work-stealing
    private workerPools: Map<string, WorkStealingWorkerPool<QueuedTask>> = new Map();

    constructor(config?: ConcurrencyConfig) {
        this.config = normalizeConfig(config);
    }

    configure(config: ConcurrencyConfig): void {
        this.config = normalizeConfig(config);
    }

    getConfig(): ConcurrencyConfig {
        return this.config;
    }

    setLimit(key: string, limit: number): void {
        this.limits.set(key, assertValidLimit(`limit for ${key}`, limit));
    }

    getConcurrencyLimit(key: string): number {
        const explicitLimit = this.limits.get(key);
        if (explicitLimit !== undefined) {
            return normalizeLimit(explicitLimit);
        }

        const configuredLimit = this.getConfiguredLimit(key);
        if (configuredLimit !== undefined) {
            return normalizeLimit(configuredLimit);
        }

        return this.config.defaultConcurrency ?? PARALLEL_TASK.DEFAULT_CONCURRENCY;
    }

    private getAcquisitionTimeoutMs(): number {
        return this.config.acquisitionTimeoutMs ?? DEFAULT_ACQUISITION_TIMEOUT_MS;
    }

    private getCircuitFailureThreshold(): number {
        return this.config.circuitFailureThreshold ?? DEFAULT_CIRCUIT_FAILURE_THRESHOLD;
    }

    private getCircuitRecoveryTimeoutMs(): number {
        return this.config.circuitRecoveryTimeoutMs ?? DEFAULT_CIRCUIT_RECOVERY_TIMEOUT_MS;
    }

    private getHalfOpenSuccessThreshold(): number {
        return this.config.halfOpenSuccessThreshold ?? DEFAULT_HALF_OPEN_SUCCESS_THRESHOLD;
    }

    private getResourcePressureMaxHeapPercent(): number {
        return this.config.resourcePressureMaxHeapPercent ?? DEFAULT_RESOURCE_PRESSURE_MAX_HEAP_PERCENT;
    }

    private getConfiguredLimit(key: string): number | undefined {
        const provider = key.split("/")[0];
        return this.config.modelConcurrency?.[key]
            ?? this.config.providerConcurrency?.[provider]
            ?? this.config.agentConcurrency?.[key];
    }

    getLimit(key: string): number {
        return this.getConcurrencyLimit(key);
    }

    /**
     * Acquire slot with priority support
     */
    async acquire(key: string, priority: TaskPriority = TaskPriority.NORMAL): Promise<void> {
        // Check circuit breaker
        if (this.isCircuitOpen(key)) {
            throw new Error(`Circuit breaker OPEN for ${key}. Try again later.`);
        }

        // Check resource pressure
        const resourcePressure = this.getResourcePressureStatus();
        if (resourcePressure.underPressure) {
            // Only block LOW priority tasks under pressure
            if (priority === TaskPriority.LOW) {
                throw new Error(
                    `Resource pressure detected (${resourcePressure.heapPercent.toFixed(1)}% heap used; ` +
                    `limit ${resourcePressure.maxHeapPercent}%). Low priority task rejected.`
                );
            }
        }

        const limit = this.getConcurrencyLimit(key);
        if (limit === Infinity) return;

        const current = this.counts.get(key) ?? 0;
        if (current < limit) {
            this.counts.set(key, current + 1);
            return;
        }

        // Queue with priority
        return new Promise<void>((resolve, reject) => {
            const queue = this.queues.get(key) ?? [];
            const timeoutMs = this.getAcquisitionTimeoutMs();

            const timeoutId = setTimeout(() => {
                this.removeFromQueue(key, resolve);
                reject(new Error(`Concurrency acquisition timed out after ${timeoutMs}ms for ${key}`));
            }, timeoutMs);

            const task: QueuedTask = {
                resolve,
                reject,
                timeoutId,
                priority,
                enqueuedAt: Date.now()
            };

            // Insert by priority (lower priority number = higher priority)
            const insertIdx = queue.findIndex(q => q.priority > priority);
            if (insertIdx === -1) {
                queue.push(task);
            } else {
                queue.splice(insertIdx, 0, task);
            }

            this.queues.set(key, queue);
        });
    }

    release(key: string): void {
        const limit = this.getConcurrencyLimit(key);
        if (limit === Infinity) return;

        const queue = this.queues.get(key);
        if (queue && queue.length > 0) {
            const next = queue.shift()!;
            clearTimeout(next.timeoutId);
            next.resolve();
        } else {
            const current = this.counts.get(key) ?? 0;
            if (current > 0) {
                this.counts.set(key, current - 1);
            }
        }
    }

    /**
     * Report result with circuit breaker integration
     */
    reportResult(key: string, success: boolean): void {
        const circuit = this.getCircuit(key);

        if (success) {
            this.handleSuccess(key, circuit);
        } else {
            this.handleFailure(key, circuit);
        }
    }

    private handleSuccess(key: string, circuit: CircuitBreaker): void {
        if (circuit.state === CircuitState.HALF_OPEN) {
            circuit.successCount++;
            if (circuit.successCount >= this.getHalfOpenSuccessThreshold()) {
                circuit.state = CircuitState.CLOSED;
                circuit.failureCount = 0;
                circuit.successCount = 0;
            }
        } else {
            circuit.failureCount = 0;
        }

        // Auto-scaling up
        const streak = (this.successStreak.get(key) ?? 0) + 1;
        this.successStreak.set(key, streak);
        this.failureCount.set(key, 0);

        if (streak >= 3) {
            const currentLimit = this.getConcurrencyLimit(key);
            if (currentLimit < PARALLEL_TASK.MAX_CONCURRENCY) {
                this.setLimit(key, currentLimit + 1);
                this.successStreak.set(key, 0);
            }
        }
    }

    private handleFailure(key: string, circuit: CircuitBreaker): void {
        circuit.failureCount++;
        circuit.lastFailureTime = Date.now();

        if (circuit.state === CircuitState.HALF_OPEN) {
            // Failed during recovery test - reopen circuit
            circuit.state = CircuitState.OPEN;
            circuit.successCount = 0;
        } else if (circuit.failureCount >= this.getCircuitFailureThreshold()) {
            circuit.state = CircuitState.OPEN;
        }

        // Auto-scaling down
        const failures = (this.failureCount.get(key) ?? 0) + 1;
        this.failureCount.set(key, failures);
        this.successStreak.set(key, 0);

        if (failures >= 2) {
            const currentLimit = this.getConcurrencyLimit(key);
            if (currentLimit > 1) {
                this.setLimit(key, currentLimit - 1);
                this.failureCount.set(key, 0);
            }
        }
    }

    private isCircuitOpen(key: string): boolean {
        const circuit = this.getCircuit(key);

        if (circuit.state === CircuitState.OPEN) {
            // Check if recovery window has passed
            if (Date.now() - circuit.lastFailureTime > this.getCircuitRecoveryTimeoutMs()) {
                circuit.state = CircuitState.HALF_OPEN;
                circuit.successCount = 0;
                return false;
            }
            return true;
        }

        return false;
    }

    private getCircuit(key: string): CircuitBreaker {
        let circuit = this.circuits.get(key);
        if (!circuit) {
            circuit = {
                state: CircuitState.CLOSED,
                failureCount: 0,
                lastFailureTime: 0,
                successCount: 0
            };
            this.circuits.set(key, circuit);
        }
        return circuit;
    }

    getResourcePressureStatus(): ResourcePressureStatus {
        const maxHeapPercent = this.getResourcePressureMaxHeapPercent();
        try {
            const usage = process.memoryUsage();
            const heapPercent = (usage.heapUsed / usage.heapTotal) * 100;
            return {
                underPressure: heapPercent > maxHeapPercent,
                heapUsed: usage.heapUsed,
                heapTotal: usage.heapTotal,
                heapPercent,
                maxHeapPercent,
            };
        } catch {
            return {
                underPressure: false,
                heapUsed: 0,
                heapTotal: 0,
                heapPercent: 0,
                maxHeapPercent,
            };
        }
    }

    private removeFromQueue(key: string, resolve: () => void): void {
        const queue = this.queues.get(key);
        if (queue) {
            const index = queue.findIndex(item => item.resolve === resolve);
            if (index !== -1) {
                queue.splice(index, 1);
                if (queue.length === 0) {
                    this.queues.delete(key);
                } else {
                    this.queues.set(key, queue);
                }
            }
        }
    }

    getQueueLength(key: string): number {
        return this.queues.get(key)?.length ?? 0;
    }

    getActiveCount(key: string): number {
        return this.counts.get(key) ?? 0;
    }

    getConcurrencyInfo(key: string): string {
        const active = this.getActiveCount(key);
        const limit = this.getConcurrencyLimit(key);
        const circuit = this.circuits.get(key);
        const circuitInfo = circuit?.state !== CircuitState.CLOSED ? ` [${circuit?.state}]` : "";
        if (limit === Infinity) return circuitInfo;
        return ` (${active}/${limit} slots)${circuitInfo}`;
    }

    /**
     * Get circuit breaker state for monitoring
     */
    getCircuitState(key: string): CircuitState {
        return this.getCircuit(key).state;
    }

    /**
     * Manually reset circuit breaker
     */
    resetCircuit(key: string): void {
        const circuit = this.getCircuit(key);
        circuit.state = CircuitState.CLOSED;
        circuit.failureCount = 0;
        circuit.successCount = 0;
    }

    /**
     * Acquire slot and return RAII token for automatic cleanup
     * @param key - Concurrency key
     * @param priority - Task priority
     * @param autoReleaseMs - Auto-release timeout (default: 10 minutes)
     * @returns ConcurrencyToken - Call .release() when done
     */
    async acquireToken(
        key: string,
        priority: TaskPriority = TaskPriority.NORMAL,
        autoReleaseMs: number = 600_000
    ): Promise<ConcurrencyToken> {
        await this.acquire(key, priority);
        let token: ConcurrencyToken;
        token = new ConcurrencyToken(this, key, autoReleaseMs, released => {
            this.activeTokens.delete(released);
        });
        this.activeTokens.add(token);
        return token;
    }

    /**
     * Enable work-stealing for a concurrency key
     * @param key - Concurrency key
     * @param workerCount - Number of workers (default: 4)
     */
    enableWorkStealing(key: string, workerCount: number = 4): void {
        if (this.workerPools.has(key)) {
            return; // Already enabled
        }

        const pool = new WorkStealingWorkerPool<QueuedTask>(workerCount, async (workItem: WorkItem<QueuedTask>) => {
            // Execute the queued task
            workItem.task.resolve();
        });

        pool.start();
        this.workerPools.set(key, pool);
    }

    /**
     * Get work-stealing pool statistics
     */
    getWorkStealingStats(key: string) {
        const pool = this.workerPools.get(key);
        return pool ? pool.getStats() : null;
    }

    /**
     * Shutdown - stops all worker pools
     */
    async shutdown(): Promise<void> {
        for (const token of Array.from(this.activeTokens)) {
            token.release();
        }
        this.activeTokens.clear();

        for (const pool of this.workerPools.values()) {
            await pool.stop();
        }
        this.workerPools.clear();
    }
}
