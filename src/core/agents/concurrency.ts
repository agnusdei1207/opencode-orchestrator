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
import type { ConcurrencyConfig } from "./interfaces/concurrency-config.interface.js";

export type { ConcurrencyConfig } from "./interfaces/concurrency-config.interface.js";

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
    private readonly CIRCUIT_THRESHOLD = 5;      // Failures before opening
    private readonly CIRCUIT_TIMEOUT = 30_000;   // 30s recovery window
    private readonly HALF_OPEN_SUCCESS = 2;      // Successes to close circuit

    // Resource awareness
    private readonly MAX_MEMORY_PERCENT = 80;    // Pause if memory > 80%

    constructor(config?: ConcurrencyConfig) {
        this.config = config ?? {};
    }

    setLimit(key: string, limit: number): void {
        this.limits.set(key, limit);
    }

    getConcurrencyLimit(key: string): number {
        const explicitLimit = this.limits.get(key);
        if (explicitLimit !== undefined) {
            return explicitLimit === 0 ? Infinity : explicitLimit;
        }

        if (this.config.modelConcurrency?.[key] !== undefined) {
            const limit = this.config.modelConcurrency[key];
            return limit === 0 ? Infinity : limit;
        }

        const provider = key.split("/")[0];
        if (this.config.providerConcurrency?.[provider] !== undefined) {
            const limit = this.config.providerConcurrency[provider];
            return limit === 0 ? Infinity : limit;
        }

        if (this.config.agentConcurrency?.[key] !== undefined) {
            const limit = this.config.agentConcurrency[key];
            return limit === 0 ? Infinity : limit;
        }

        return this.config.defaultConcurrency ?? PARALLEL_TASK.DEFAULT_CONCURRENCY;
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
        if (this.isUnderResourcePressure()) {
            // Only block LOW priority tasks under pressure
            if (priority === TaskPriority.LOW) {
                throw new Error(`Resource pressure detected. Low priority task rejected.`);
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

            const timeoutId = setTimeout(() => {
                this.removeFromQueue(key, resolve);
                reject(new Error(`Concurrency acquisition timed out after 300s for ${key}`));
            }, 300_000);

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
            if (circuit.successCount >= this.HALF_OPEN_SUCCESS) {
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
        } else if (circuit.failureCount >= this.CIRCUIT_THRESHOLD) {
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
            if (Date.now() - circuit.lastFailureTime > this.CIRCUIT_TIMEOUT) {
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

    private isUnderResourcePressure(): boolean {
        try {
            const usage = process.memoryUsage();
            const heapPercent = (usage.heapUsed / usage.heapTotal) * 100;
            return heapPercent > this.MAX_MEMORY_PERCENT;
        } catch {
            return false;
        }
    }

    private removeFromQueue(key: string, resolve: () => void): void {
        const queue = this.queues.get(key);
        if (queue) {
            const index = queue.findIndex(item => item.resolve === resolve);
            if (index !== -1) {
                queue.splice(index, 1);
                this.queues.set(key, queue);
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
}

