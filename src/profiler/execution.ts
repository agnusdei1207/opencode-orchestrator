/**
 * Execution Profiler
 *
 * Tracks and analyzes agent performance metrics.
 * Provides data-driven optimization insights.
 */

export interface Metric {
  operation: string;
  duration: number;
  timestamp: number;
  agent: string;
  success: boolean;
}

export interface PerformanceMetrics {
  agent: string;
  operations: Metric[];
  averageDuration: number;
  medianDuration: number;
  totalDuration: number;
  operationCount: number;
  successRate: number;
}

export interface Analysis {
  performance: Record<string, PerformanceMetrics>;
  outliers: Metric[];
  suggestions: string[];
  bottlenecks: string[];
}

export class ExecutionProfiler {
  private metrics: Map<string, Metric[]> = new Map();

  record(agent: string, operation: string, duration: number, success: boolean = true): void {
    const metrics = this.metrics.get(agent) || [];
    metrics.push({
      operation,
      duration,
      timestamp: Date.now(),
      agent,
      success,
    });
    this.metrics.set(agent, metrics);
  }

  getMetrics(agent: string): Metric[] {
    return this.metrics.get(agent) || [];
  }

  analyze(agent: string): PerformanceMetrics {
    const metrics = this.getMetrics(agent);

    if (metrics.length === 0) {
      return {
        agent,
        operations: [],
        averageDuration: 0,
        medianDuration: 0,
        totalDuration: 0,
        operationCount: 0,
        successRate: 1.0,
      };
    }

    const operations = metrics;
    const durations = operations.map(m => m.duration);
    const successful = operations.filter(m => m.success);

    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const averageDuration = totalDuration / durations.length;

    const sortedDurations = [...durations].sort((a, b) => a - b);
    const medianIndex = Math.floor(sortedDurations.length / 2);
    const medianDuration = sortedDurations.length % 2 === 0
      ? (sortedDurations[medianIndex - 1] + sortedDurations[medianIndex]) / 2
      : sortedDurations[medianIndex];

    const successRate = successful.length / operations.length;

    return {
      agent,
      operations,
      averageDuration,
      medianDuration,
      totalDuration,
      operationCount: operations.length,
      successRate,
    };
  }

  analyzeAll(): Analysis {
    const performance: Record<string, PerformanceMetrics> = {};
    const outliers: Metric[] = [];
    const suggestions: string[] = [];
    const bottlenecks: string[] = [];

    for (const [agent] of this.metrics.keys()) {
      performance[agent] = this.analyze(agent);

      const metrics = this.getMetrics(agent);
      const perf = performance[agent];
      if (metrics.length > 0) {
        const threshold = perf.medianDuration * 2;
        for (const metric of metrics) {
          if (metric.duration > threshold) {
            outliers.push(metric);
          }
        }
      }
    }

    for (const [agent, perf] of Object.entries(performance)) {
      if (perf.operationCount === 0) continue;

      if (perf.averageDuration > 10000) {
        suggestions.push(agent + " average is slow. Consider breaking into smaller tasks.");
      }

      if (perf.successRate < 0.8) {
        suggestions.push(agent + " has low success rate. Review and adjust prompts.");
      }

      if (perf.averageDuration > perf.medianDuration * 1.5) {
        bottlenecks.push(agent + " has high variance. Average " + (perf.averageDuration / 1000).toFixed(1) + "s vs median " + (perf.medianDuration / 1000).toFixed(1) + "s.");
      }

      if (perf.operationCount > 10 && perf.totalDuration > 60000) {
        bottlenecks.push(agent + " executed many operations. Consider task batching.");
      }
    }

    return {
      performance,
      outliers,
      suggestions,
      bottlenecks,
    };
  }

  formatAnalysis(analysis: Analysis): string {
    let output = "Performance Analysis:\n\n";

    for (const [agent, perf] of Object.entries(analysis.performance)) {
      if (perf.operationCount === 0) continue;

      output += agent.toUpperCase() + "\n";
      output += "  Operations: " + perf.operationCount + "\n";
      output += "  Average: " + (perf.averageDuration / 1000).toFixed(2) + "s\n";
      output += "  Median: " + (perf.medianDuration / 1000).toFixed(2) + "s\n";
      output += "  Total: " + (perf.totalDuration / 1000).toFixed(1) + "s\n";
      output += "  Success: " + (perf.successRate * 100).toFixed(1) + "%\n\n";
    }

    if (analysis.outliers.length > 0) {
      output += "Outliers:\n";
      for (const outlier of analysis.outliers.slice(0, 5)) {
        output += "  " + outlier.agent + ": " + outlier.operation + " took " + (outlier.duration / 1000).toFixed(1) + "s\n";
      }
      output += "\n";
    }

    if (analysis.suggestions.length > 0) {
      output += "Suggestions:\n";
      for (const suggestion of analysis.suggestions) {
        output += "  " + suggestion + "\n";
      }
      output += "\n";
    }

    if (analysis.bottlenecks.length > 0) {
      output += "Bottlenecks:\n";
      for (const bottleneck of analysis.bottlenecks) {
        output += "  " + bottleneck + "\n";
      }
    }

    return output;
  }

  clear(): void {
    this.metrics.clear();
  }

  toJSON(): string {
    const data: Record<string, Metric[]> = {};
    for (const [agent, metrics] of this.metrics) {
      data[agent] = metrics;
    }
    return JSON.stringify(data, null, 2);
  }

  static fromJSON(json: string): ExecutionProfiler {
    try {
      const profiler = new ExecutionProfiler();
      const data = JSON.parse(json) as Record<string, Metric[]>;
      for (const [agent, metrics] of Object.entries(data)) {
        profiler.metrics.set(agent, metrics);
      }
      return profiler;
    } catch {
      return new ExecutionProfiler();
    }
  }
}

export const executionProfiler = new ExecutionProfiler();
