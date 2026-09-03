import { describe, it, expect, beforeEach } from "vitest";
import { MetricsCollector } from "../../src/core/metrics/collector.js";

describe("MetricsCollector", () => {
    beforeEach(() => {
        MetricsCollector._resetForTesting();
    });

    it("records agent and tool latency, token usage, lines, and task success", () => {
        const collector = MetricsCollector.getInstance();

        collector.recordAgentExecution("worker", 100);
        collector.recordAgentExecution("worker", 200);
        collector.recordAgentExecution("planner", 300);

        collector.recordToolExecution("grep", 50);
        collector.recordToolExecution("grep", 150);

        collector.recordTokenUsage(500);
        collector.recordLinesProduced(100);

        collector.recordTaskResult("t1", true);
        collector.recordTaskResult("t2", false);

        const stats = collector.getStats();

        expect(stats.avgAgentLatency["worker"]).toBe(150);
        expect(stats.avgAgentLatency["planner"]).toBe(300);
        expect(stats.avgToolLatency["grep"]).toBe(100);
        expect(stats.tokenUsage).toBe(500);
        expect(stats.efficiency).toBe(5); // 500 / 100
        expect(stats.totalTasks).toBe(2);
        expect(stats.successRate).toBe(0.5);
    });

    it("handles empty stats safely", () => {
        const collector = MetricsCollector.getInstance();
        const stats = collector.getStats();

        expect(stats.totalTasks).toBe(0);
        expect(stats.successRate).toBe(0);
        expect(stats.efficiency).toBe(0);
        expect(stats.tokenUsage).toBe(0);
    });
});
