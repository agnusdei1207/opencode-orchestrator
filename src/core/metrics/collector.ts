/**
 * MetricsCollector - Tracks system performance and token usage
 */

export interface PerformanceStats {
    avgAgentLatency: Record<string, number>;
    avgToolLatency: Record<string, number>;
    tokenUsage: number;
    efficiency: number; // tokens/line or similar
    totalTasks: number;
    successRate: number;
}

export class MetricsCollector {
    private static instance: MetricsCollector;

    private agentLatencies: Map<string, number[]> = new Map();
    private toolLatencies: Map<string, number[]> = new Map();
    private tokenUsage: number = 0;
    private lineCount: number = 0;
    private tasks: { id: string; success: boolean }[] = [];

    private constructor() { }

    public static getInstance(): MetricsCollector {
        if (!MetricsCollector.instance) {
            MetricsCollector.instance = new MetricsCollector();
        }
        return MetricsCollector.instance;
    }

    public recordAgentExecution(agent: string, duration: number): void {
        const latencies = this.agentLatencies.get(agent) || [];
        latencies.push(duration);
        this.agentLatencies.set(agent, latencies);
    }

    public recordToolExecution(tool: string, duration: number): void {
        const latencies = this.toolLatencies.get(tool) || [];
        latencies.push(duration);
        this.toolLatencies.set(tool, latencies);
    }

    public recordTokenUsage(tokens: number): void {
        this.tokenUsage += tokens;
    }

    public recordTaskResult(id: string, success: boolean): void {
        this.tasks.push({ id, success });
    }

    public recordLinesProduced(lines: number): void {
        this.lineCount += lines;
    }

    public getStats(): PerformanceStats {
        const avgAgentLatency: Record<string, number> = {};
        for (const [agent, lats] of this.agentLatencies.entries()) {
            avgAgentLatency[agent] = Math.round(lats.reduce((a, b) => a + b, 0) / lats.length);
        }

        const avgToolLatency: Record<string, number> = {};
        for (const [tool, lats] of this.toolLatencies.entries()) {
            avgToolLatency[tool] = Math.round(lats.reduce((a, b) => a + b, 0) / lats.length);
        }

        const successfulTasks = this.tasks.filter(t => t.success).length;

        return {
            avgAgentLatency,
            avgToolLatency,
            tokenUsage: this.tokenUsage,
            efficiency: this.lineCount > 0 ? this.tokenUsage / this.lineCount : 0,
            totalTasks: this.tasks.length,
            successRate: this.tasks.length > 0 ? successfulTasks / this.tasks.length : 0,
        };
    }
}
