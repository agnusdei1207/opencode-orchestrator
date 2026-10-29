/**
 * show_metrics Tool - average tool latency and estimated token usage for the project.
 */

import { tool } from "../../host/tool.js";
import { MetricsCollector } from "../../core/metrics/collector.js";
import { OUTPUT_LABEL } from "../../shared/index.js";

export const createShowMetricsTool = () => tool({
    description: "Show average tool latency and estimated token usage for this project.",
    args: {},
    async execute(_args, context) {
        // OpenCode passes the directory of the session that called the tool.
        const stats = MetricsCollector.getInstance(context.directory).getStats();
        const latencies = Object.entries(stats.avgToolLatency).map(([name, ms]) => `- \`${name}\`: ${ms}ms`);
        return [
            `${OUTPUT_LABEL.INFO} **Performance Dashboard**`,
            "",
            "### Tool latency (average)",
            ...(latencies.length > 0 ? latencies : ["- No tool calls recorded yet."]),
            "",
            "### Usage",
            `- Estimated tokens: ${Math.round(stats.tokenUsage).toLocaleString()}`,
        ].join("\n");
    },
});
