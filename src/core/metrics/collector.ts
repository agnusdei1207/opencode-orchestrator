/**
 * MetricsCollector - Tracks system performance and token usage
 *
 * Every reported value is an all-time aggregate, so samples are folded into
 * running totals as they arrive instead of being retained: memory stays
 * constant per agent/tool key no matter how long the process runs.
 */

import { resolve } from "node:path";

interface PerformanceStats {
    avgToolLatency: Record<string, number>;
    tokenUsage: number;
}

interface LatencyTotal {
    sum: number;
    count: number;
}

function addLatency(totals: Map<string, LatencyTotal>, key: string, duration: number): void {
    const total = totals.get(key) ?? { sum: 0, count: 0 };
    total.sum += duration;
    total.count += 1;
    totals.set(key, total);
}

function averageLatencies(totals: Map<string, LatencyTotal>): Record<string, number> {
    const averages: Record<string, number> = {};
    for (const [key, { sum, count }] of totals.entries()) {
        averages[key] = Math.round(sum / count);
    }
    return averages;
}

/**
 * One collector per project directory, so a process serving several projects
 * reports each project's own dashboard.
 */
export class MetricsCollector {
    private static readonly instances = new Map<string, MetricsCollector>();

    private toolLatencies: Map<string, LatencyTotal> = new Map();
    private tokenUsage: number = 0;

    private constructor() { }

    public static getInstance(directory: string): MetricsCollector {
        const key = resolve(directory);
        let collector = MetricsCollector.instances.get(key);
        if (!collector) {
            collector = new MetricsCollector();
            MetricsCollector.instances.set(key, collector);
        }
        return collector;
    }

    public static _resetForTesting(): void {
        MetricsCollector.instances.clear();
    }

    public recordToolExecution(tool: string, duration: number): void {
        addLatency(this.toolLatencies, tool, duration);
    }

    public recordTokenUsage(tokens: number): void {
        this.tokenUsage += tokens;
    }

    public getStats(): PerformanceStats {
        return {
            avgToolLatency: averageLatencies(this.toolLatencies),
            tokenUsage: this.tokenUsage,
        };
    }
}
