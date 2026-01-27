import { log } from './logger';

export interface AdaptiveConcurrencyConfig {
    /** Global maximum concurrent tasks across all agents */
    globalMax: number;

    /** Minimum slots per agent */
    perAgentMin: number;

    /** Maximum slots per agent */
    perAgentMax: number;

    /** Success rate threshold to scale up slots (0.0 - 1.0) */
    scaleUpThreshold: number;

    /** Success rate threshold to scale down slots (0.0 - 1.0) */
    scaleDownThreshold: number;

    /** How often to adjust limits (ms) */
    adjustmentInterval: number;
}

const DEFAULT_ADAPTIVE_CONFIG: AdaptiveConcurrencyConfig = {
    globalMax: 30,
    perAgentMin: 1,
    perAgentMax: 10,
    scaleUpThreshold: 0.9,      // Scale up if success rate >= 90%
    scaleDownThreshold: 0.5,    // Scale down if success rate < 50%
    adjustmentInterval: 60000,  // Adjust every 1 minute
};

interface AgentMetrics {
    success: number;
    failure: number;
    latency: number[];
}

/**
 * Dynamically adjusts agent concurrency limits based on performance metrics.
 * Now acts as a full controller with acquire/release.
 */
export class AdaptiveConcurrencyController {
    private config: AdaptiveConcurrencyConfig;
    private currentLimits: Map<string, number> = new Map();
    private activeCount: Map<string, number> = new Map();
    private metrics: Map<string, AgentMetrics> = new Map();
    private adjustmentTimer: NodeJS.Timeout | null = null;
    private waiters: Array<{ agent: string; resolve: () => void }> = [];

    constructor(config?: Partial<AdaptiveConcurrencyConfig>) {
        this.config = { ...DEFAULT_ADAPTIVE_CONFIG, ...config };
        this.startAdjustmentCycle();
    }

    /**
     * Acquire a concurrency slot for an agent.
     * Blocks if limit reached.
     */
    async acquire(agent: string): Promise<void> {
        while (!this.canAcquire(agent)) {
            await new Promise<void>(resolve => {
                this.waiters.push({ agent, resolve });
            });
        }

        const count = this.activeCount.get(agent) || 0;
        this.activeCount.set(agent, count + 1);
    }

    /**
     * Release a concurrency slot.
     */
    release(agent: string): void {
        const count = this.activeCount.get(agent) || 0;
        if (count > 0) {
            this.activeCount.set(agent, count - 1);
        }

        // Wake up one waiter for this agent or ANY agent if global limit was bottleneck
        // To be safe, try waking up waiters in order
        const waiterIdx = this.waiters.findIndex(w => this.canAcquire(w.agent));
        if (waiterIdx !== -1) {
            const waiter = this.waiters.splice(waiterIdx, 1)[0];
            waiter.resolve();
        }
    }

    private canAcquire(agent: string): boolean {
        // Check global limit
        const totalActive = Array.from(this.activeCount.values()).reduce((a, b) => a + b, 0);
        if (totalActive >= this.config.globalMax) return false;

        // Check per-agent limit
        const limit = this.getLimit(agent);
        const active = this.activeCount.get(agent) || 0;
        return active < limit;
    }

    /**
     * Get the current limit for a specific agent.
     */
    getLimit(agent: string): number {
        if (!this.currentLimits.has(agent)) {
            this.currentLimits.set(agent, this.config.perAgentMin);
        }
        return this.currentLimits.get(agent)!;
    }

    /**
     * Report task execution result for adaptive calculation.
     */
    reportResult(agent: string, success: boolean, latencyMs: number = 0): void {
        let m = this.metrics.get(agent);
        if (!m) {
            m = { success: 0, failure: 0, latency: [] };
            this.metrics.set(agent, m);
        }

        if (success) m.success++;
        else m.failure++;

        m.latency.push(latencyMs);

        // Cap latency history to avoid memory bloat
        if (m.latency.length > 50) m.latency.shift();
    }

    /**
     * Starts the periodic adjustment cycle.
     */
    private startAdjustmentCycle(): void {
        this.adjustmentTimer = setInterval(() => {
            this.adjustLimits();
        }, this.config.adjustmentInterval);

        // Don't let the timer block process exit
        if (this.adjustmentTimer.unref) {
            this.adjustmentTimer.unref();
        }
    }

    /**
     * Adjusts agent limits based on accumulated metrics.
     */
    private adjustLimits(): void {
        for (const [agent, metrics] of this.metrics.entries()) {
            const total = metrics.success + metrics.failure;
            if (total < 3) continue; // Not enough data for this period

            const successRate = metrics.success / total;
            const currentLimit = this.getLimit(agent);

            if (successRate >= this.config.scaleUpThreshold && currentLimit < this.config.perAgentMax) {
                const newLimit = currentLimit + 1;
                this.currentLimits.set(agent, newLimit);
                log(`[AdaptiveConcurrency] ${agent}: ${currentLimit} -> ${newLimit} (Success rate: ${(successRate * 100).toFixed(1)}%)`);
            } else if (successRate < this.config.scaleDownThreshold && currentLimit > this.config.perAgentMin) {
                const newLimit = currentLimit - 1;
                this.currentLimits.set(agent, newLimit);
                log(`[AdaptiveConcurrency] ${agent}: ${currentLimit} -> ${newLimit} (Success rate: ${(successRate * 100).toFixed(1)}%)`);
            }

            // Reset metrics for the next period
            this.metrics.set(agent, { success: 0, failure: 0, latency: [] });
        }
    }

    /**
     * Stops the controller and cleans up.
     */
    cleanup(): void {
        if (this.adjustmentTimer) {
            clearInterval(this.adjustmentTimer);
            this.adjustmentTimer = null;
        }
    }
}
