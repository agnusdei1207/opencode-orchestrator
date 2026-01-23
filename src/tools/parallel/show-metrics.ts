/**
 * show_metrics Tool
 * 
 * Displays a performance dashboard for the current mission.
 */

import { tool } from "@opencode-ai/plugin";
import { MetricsCollector } from "../../core/metrics/collector.js";
import { OUTPUT_LABEL } from "../../shared/index.js";

export const createShowMetricsTool = () => tool({
    description: "Display a performance dashboard for the current mission, showing tool/agent latency and token usage.",
    args: {},
    async execute() {
        const stats = MetricsCollector.getInstance().getStats();

        let output = `${OUTPUT_LABEL.INFO} **Performance Dashboard**\n\n`;

        output += `### ⏱️ Latency (Average)\n\n`;
        output += `**Tools:**\n`;
        for (const [tool, lat] of Object.entries(stats.avgToolLatency)) {
            output += `- \`${tool}\`: ${lat}ms\n`;
        }

        output += `\n**Agents:**\n`;
        for (const [agent, lat] of Object.entries(stats.avgAgentLatency)) {
            output += `- \`${agent}\`: ${lat}ms\n`;
        }

        output += `\n### 🪙 Resource Usage\n\n`;
        output += `- **Total Tokens (Est.)**: ${Math.round(stats.tokenUsage).toLocaleString()}\n`;
        output += `- **Mission Success Rate**: ${Math.round(stats.successRate * 100)}%\n`;
        output += `- **Total Sub-tasks**: ${stats.totalTasks}\n`;

        return output;
    }
});
