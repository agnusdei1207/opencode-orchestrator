/**
 * Configuration Management Tool
 *
 * Tools for viewing and modifying configuration at runtime.
 */

import { tool } from "@opencode-ai/plugin";
import { configManager } from "../core/config.js";

type OpencodeClient = Parameters<typeof tool>[0] extends { execute: infer E }
  ? E extends (args: unknown, context: infer C) => unknown
    ? C extends { client?: infer CL }
      ? CL
      : never
    : never
  : never;

/**
 * show_config - Display current configuration
 */
export const createShowConfigTool = () =>
  tool({
    description: `Display current OpenCode Orchestrator configuration.

Shows all dynamic settings including timeouts, concurrency limits, and debug flags.`,
    args: {},
    async execute() {
      configManager.exportConfigs();
      return '';
    },
  });

/**
 * set_concurrency - Update agent concurrency limits at runtime
 */
export const createSetConcurrencyTool = (client: unknown) =>
  tool({
    description: `Update concurrency limit for a specific agent type.

<examples>
set_concurrency({ agent: "builder", limit: 5 })
set_concurrency({ agent: "inspector", limit: 2 })
</examples>

<notes>
- Changes take effect immediately
- Queued tasks will start when slots become available
- Limit cannot exceed global max (10)
</notes>`,
    args: {
      agent: tool.schema.string().describe('Agent type (e.g., "builder", "inspector", "architect")'),
      limit: tool.schema.string().describe('New concurrency limit (number)'),
    },
    async execute(args) {
      const { agent, limit } = args;
      const numLimit = parseInt(limit, 10);

      if (isNaN(numLimit) || numLimit < 1) {
        return `❌ Invalid limit: "${limit}". Must be a number >= 1.`;
      }

      const maxLimit = configManager.getParallelAgentConfig().maxConcurrency;
      if (numLimit > maxLimit) {
        return `❌ Limit ${numLimit} exceeds global max ${maxLimit}. Using ${maxLimit}.`;
      }

      configManager.updateParallelAgentConfig({
        defaultConcurrency: numLimit,
      });

      return `✅ **Concurrency Updated**

| Property | Value |
|----------|-------|
| **Agent** | ${agent} |
| **New Limit** | ${numLimit} parallel tasks |

Changes take effect immediately. New tasks will respect to the new limit.`;
    },
  });

/**
 * set_timeout - Update task timeout settings
 */
export const createSetTimeoutTool = () =>
  tool({
    description: `Update task timeout duration.

<examples>
set_timeout({ taskTtlMinutes: 45 })
set_timeout({ cleanupDelayMinutes: 2 })
</examples>`,
    args: {
      taskTtlMinutes: tool.schema.string().optional().describe('Task timeout in minutes (default: 30)'),
      cleanupDelayMinutes: tool.schema.string().optional().describe('Cleanup delay after completion in minutes (default: 5)'),
    },
    async execute(args) {
      const { taskTtlMinutes, cleanupDelayMinutes } = args;
      const updates: any = {};

      if (taskTtlMinutes) {
        const ttl = parseInt(taskTtlMinutes, 10);
        if (isNaN(ttl) || ttl < 1) {
          return `❌ Invalid taskTtlMinutes: "${taskTtlMinutes}". Must be number >= 1.`;
        }
        updates.taskTtlMs = ttl * 60 * 1000;
      }

      if (cleanupDelayMinutes) {
        const delay = parseInt(cleanupDelayMinutes, 10);
        if (isNaN(delay) || delay < 0) {
          return `❌ Invalid cleanupDelayMinutes: "${cleanupDelayMinutes}". Must be number >= 0.`;
        }
        updates.cleanupDelayMs = delay * 60 * 1000;
      }

      if (Object.keys(updates).length === 0) {
        return '⚠️ No changes specified. Provide at least one parameter.';
      }

      configManager.updateParallelAgentConfig(updates);

      let output = '✅ **Timeout Configuration Updated**\n\n';
      if (updates.taskTtlMs) {
        output += `| Task TTL | ${updates.taskTtlMs / 60 / 1000} minutes |\n`;
      }
      if (updates.cleanupDelayMs) {
        output += `| Cleanup Delay | ${updates.cleanupDelayMs / 60 / 1000} minutes |\n`;
      }

      output += '\nChanges take effect immediately.';
      return output;
    },
  });

/**
 * set_debug - Toggle debug logging
 */
export const createSetDebugTool = () =>
  tool({
    description: `Enable or disable debug logging.

<examples>
set_debug({ component: "parallel_agent", enable: true })
set_debug({ component: "background_task", enable: false })
</examples>`,
    args: {
      component: tool.schema.string().describe('Component to debug: "parallel_agent", "background_task", or "all"'),
      enable: tool.schema.boolean().describe('Enable (true) or disable (false) debug logs'),
    },
    async execute(args) {
      const { component, enable } = args;

      const enableValue = enable ? 'true' : 'false';

      if (component === 'parallel_agent' || component === 'all') {
        process.env.OPENCODE_DEBUG_PARALLEL = enableValue;
        configManager.updateParallelAgentConfig({
          enableDebug: enable,
        });
      }

      if (component === 'background_task' || component === 'all') {
        process.env.OPENCODE_DEBUG_BACKGROUND = enableValue;
        configManager.updateBackgroundTaskConfig({
          enableDebug: enable,
        });
      }

      return `✅ **Debug Logging ${enable ? 'Enabled' : 'Disabled'}**

| Component | Debug Status |
|-----------|--------------|
| ${component === 'all' ? 'parallel_agent' : component} | ${enable ? '🔧 Enabled' : '🔇 Disabled'} |
${component === 'all' ? '| background_task | 🔧 Enabled |' : ''}

Changes take effect immediately.`;
    },
  });

/**
 * Factory to create all configuration tools
 */
export function createConfigTools(client?: unknown): Record<string, ReturnType<typeof tool>> {
  return {
    show_config: createShowConfigTool(),
    set_concurrency: createSetConcurrencyTool(client),
    set_timeout: createSetTimeoutTool(),
    set_debug: createSetDebugTool(),
  };
}
