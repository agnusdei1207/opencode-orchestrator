import { it, expect, beforeEach } from "vitest";
import { MetricsCollector } from "../../src/core/metrics/collector.js";

beforeEach(() => {
    MetricsCollector._resetForTesting();
});

it("records tool latency and token usage", () => {
    const collector = MetricsCollector.getInstance("/tmp/metrics-project");

    collector.recordToolExecution("grep", 50);
    collector.recordToolExecution("grep", 150);
    collector.recordToolExecution("read", 30);

    collector.recordTokenUsage(500);
    collector.recordTokenUsage(250);

    const stats = collector.getStats();

    expect(stats.avgToolLatency).toEqual({ grep: 100, read: 30 });
    expect(stats.tokenUsage).toBe(750);
});

it("keeps memory bounded while reporting exact all-time stats", () => {
    const collector = MetricsCollector.getInstance("/tmp/metrics-project");
    const samples = 10_000;
    for (let i = 1; i <= samples; i++) {
        collector.recordToolExecution("grep", i);
    }

    expect(countStoredValues(collector)).toBeLessThan(100);
    const stats = collector.getStats();
    expect(stats.avgToolLatency["grep"]).toBe(Math.round((samples + 1) / 2));
});

it("handles empty stats safely", () => {
    const collector = MetricsCollector.getInstance("/tmp/metrics-project");
    const stats = collector.getStats();

    expect(stats.avgToolLatency).toEqual({});
    expect(stats.tokenUsage).toBe(0);
});

/** Counts every value retained in the collector's maps, arrays and objects. */
function countStoredValues(value: unknown): number {
    if (value instanceof Map) return [...value.values()].reduce((sum: number, item) => sum + 1 + countStoredValues(item), 0);
    if (Array.isArray(value)) return value.reduce((sum: number, item) => sum + 1 + countStoredValues(item), 0);
    if (typeof value === "object" && value !== null) {
        return Object.values(value).reduce((sum: number, item) => sum + 1 + countStoredValues(item), 0);
    }
    return 0;
}

// One OpenCode process can serve several projects at once.
it("keeps each project's metrics separate", () => {
    MetricsCollector.getInstance("/tmp/metrics-project").recordTokenUsage(42);

    expect(MetricsCollector.getInstance("/tmp/metrics-project").getStats().tokenUsage).toBe(42);
    expect(MetricsCollector.getInstance("/tmp/metrics-other-project").getStats().tokenUsage).toBe(0);
});
