/**
 * MetricsCollector - Tracks system performance and token usage
 *
 * Every reported value is an all-time aggregate, so samples are folded into
 * running totals as they arrive instead of being retained: memory stays
 * constant per agent/tool key no matter how long the process runs.
 */

interface PerformanceStats {
    avgAgentLatency: Record<string, number>;
    avgToolLatency: Record<string, number>;
    tokenUsage: number;
    efficiency: number; // tokens/line or similar
    totalTasks: number;
    successRate: number;
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

export class MetricsCollector {
    private static instance: MetricsCollector;

    private agentLatencies: Map<string, LatencyTotal> = new Map();
    private toolLatencies: Map<string, LatencyTotal> = new Map();
    private tokenUsage: number = 0;
    private lineCount: number = 0;
    private taskCount: number = 0;
    private successfulTaskCount: number = 0;

    private constructor() { }

    public static getInstance(): MetricsCollector {
        if (!MetricsCollector.instance) {
            MetricsCollector.instance = new MetricsCollector();
        }
        return MetricsCollector.instance;
    }

    public static _resetForTesting(): void {
        MetricsCollector.instance = new MetricsCollector();
    }

    public recordAgentExecution(agent: string, duration: number): void {
        addLatency(this.agentLatencies, agent, duration);
    }

    public recordToolExecution(tool: string, duration: number): void {
        addLatency(this.toolLatencies, tool, duration);
    }

    public recordTokenUsage(tokens: number): void {
        this.tokenUsage += tokens;
    }

    public recordTaskResult(_id: string, success: boolean): void {
        this.taskCount += 1;
        if (success) this.successfulTaskCount += 1;
    }

    public recordLinesProduced(lines: number): void {
        this.lineCount += lines;
    }

    public getStats(): PerformanceStats {
        return {
            avgAgentLatency: averageLatencies(this.agentLatencies),
            avgToolLatency: averageLatencies(this.toolLatencies),
            tokenUsage: this.tokenUsage,
            efficiency: this.lineCount > 0 ? this.tokenUsage / this.lineCount : 0,
            totalTasks: this.taskCount,
            successRate: this.taskCount > 0 ? this.successfulTaskCount / this.taskCount : 0,
        };
    }
}
