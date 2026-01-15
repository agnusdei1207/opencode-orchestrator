/**
 * Smart Batch Tool - Centralized validation and retry
 *
 * Execute many tasks with intelligent batching, validation, and retry.
 */

import { tool } from "@opencode-ai/plugin";
import { ParallelAgentManager } from "../core/async-agent.js";
import { SmartBatchProcessor, type BatchTask } from "../core/batch-processor.js";

type OpencodeClient = Parameters<typeof tool>[0] extends { execute: infer E }
  ? E extends (args: unknown, context: infer C) => unknown
    ? C extends { client?: infer CL }
      ? CL
      : never
    : never
  : never;

/**
 * process_batch - Execute multiple tasks with smart validation
 */
export const createProcessBatchTool = (parallelAgentManager: ParallelAgentManager, client: unknown) =>
  tool({
    description: `Execute a batch of tasks with intelligent validation and retry.

<strategy>
1. Execute all tasks in parallel (respecting concurrency limits)
2. Centralized validation: Identify ALL failed tasks at once
3. Retry ONLY failed tasks (not everything)
</strategy>

<benefits>
- Faster than naive retry: Failed tasks batch-identified
- More efficient: No redundant work on successful tasks
- Controlled: Concurrency limits prevent API overload
</benefits>

<examples>
process_batch({
  concurrency: 10,
  tasks: [
    { id: "task1", agent: "builder", description: "Test A", prompt: "..." },
    { id: "task2", agent: "inspector", description: "Test B", prompt: "..." }
  ]
})
</examples>`,
    args: {
      concurrency: tool.schema.string().describe('Concurrency limit (default: 3, max: 10)'),
      maxRetries: tool.schema.string().optional().describe('Maximum retry rounds (default: 2)'),
      validateAfterEach: tool.schema.boolean().optional().describe('Validate after each task (default: false = centralized validation)'),
      tasks: tool.schema.string().describe('Array of task objects in JSON format'),
    },
    async execute(args) {
      const { concurrency, maxRetries = '2', validateAfterEach = false, tasks } = args;

      let taskList: BatchTask[];
      try {
        taskList = JSON.parse(tasks);
      } catch {
        return '❌ Invalid tasks JSON. Must be valid array.';
      }

      if (!Array.isArray(taskList)) {
        return '❌ tasks must be an array of task objects.';
      }

      for (const task of taskList) {
        if (!task.id || !task.agent || !task.description || !task.prompt) {
          return `❌ Task missing required fields (id, agent, description, prompt)`;
        }
      }

      const numConcurrency = parseInt(concurrency, 10);
      const numRetries = parseInt(maxRetries, 10);

      if (isNaN(numConcurrency) || numConcurrency < 1 || numConcurrency > 10) {
        return '❌ Invalid concurrency. Must be 1-10.';
      }

      if (isNaN(numRetries) || numRetries < 0 || numRetries > 5) {
        return '❌ Invalid maxRetries. Must be 0-5.';
      }

      const processor = new SmartBatchProcessor(parallelAgentManager);

      const result = await processor.processBatch(taskList, {
        concurrency: numConcurrency,
        maxRetries: numRetries,
        validateAfterEach,
        continueOnError: true,
      });

      const durationSecs = Math.floor(result.duration / 1000);
      const successRate = ((result.success / result.total) * 100).toFixed(1);

      let output = `✅ **Batch Processing Complete**

| Metric | Value |
|---------|--------|
| **Total Tasks** | ${result.total} |
| **Successful** | ${result.success} (${successRate}%) |
| **Failed** | ${result.failed} |
| **Retried** | ${result.retried} |
| **Duration** | ${durationSecs}s |

`;

      if (result.failed > 0) {
        output += `⚠️ **Failed Tasks**

Use \`export_failed_tasks()\` to review failed tasks and manually fix issues.

---

Failed Task IDs:
${result.tasks.filter(t => t.status === 'failed').map(t => `  - ${t.id}`).join('\n')}
---
`;
      }

      return output;
    },
  });

/**
 * export_failed_tasks - Export failed tasks for manual review
 */
export const createExportFailedTasksTool = (parallelAgentManager: ParallelAgentManager) =>
  tool({
    description: `Export failed tasks from the last batch for manual review.`,
    args: {},
    async execute() {
      const processor = new SmartBatchProcessor(parallelAgentManager);
      return processor.exportFailedTasks();
    },
  });

/**
 * compare_strategies - Compare performance of different strategies
 */
export const createCompareStrategiesTool = (parallelAgentManager: ParallelAgentManager) =>
  tool({
    description: `Compare naive retry vs smart batch validation performance.

<comparison>
**Naive Strategy** (current):
- Concurrency: 3 fixed
- Retry: Per-task immediate retry
- Issue: Slow for large batches, redundant work

**Smart Batch Strategy** (new):
- Concurrency: Configurable (up to 10)
- Validation: Centralized, batch-identify failures
- Retry: Only failed tasks
- Benefit: Faster, less redundant work
</comparison>`,
    args: {
      taskCount: tool.schema.string().describe('Number of simulated tasks (default: 100)'),
      concurrency1: tool.schema.string().optional().describe('Strategy 1 concurrency (default: 3)'),
      concurrency2: tool.schema.string().optional().describe('Strategy 2 concurrency (default: 10)'),
    },
    async execute(args) {
      const taskCount = parseInt(args.taskCount || '100', 10);
      const concurrency1 = parseInt(args.concurrency1 || '3', 10);
      const concurrency2 = parseInt(args.concurrency2 || '10', 10);

      const naiveBatches = Math.ceil(taskCount / concurrency1);
      const naiveTime = naiveBatches * 60;

      const smartBatches = Math.ceil(taskCount / concurrency2);
      const smartTime = smartBatches * 60 + 30;

      const timeDiff = naiveTime - smartTime;
      const improvement = ((timeDiff / naiveTime) * 100).toFixed(1);

      return `📊 **Strategy Comparison for ${taskCount} tasks**

**Strategy 1: Naive (Current)**
| Metric | Value |
|---------|--------|
| Concurrency | ${concurrency1} |
| Batches | ${naiveBatches} |
| Est. Time | ${naiveTime}s |

**Strategy 2: Smart Batch (Proposed)**
| Metric | Value |
|---------|--------|
| Concurrency | ${concurrency2} |
| Batches | ${smartBatches} |
| Est. Time | ${smartTime}s |

**Summary**
| Metric | Value |
|---------|--------|
| Time Saved | ${timeDiff}s (${improvement}%) |
| Batches Saved | ${naiveBatches - smartBatches} |

Recommendation: Use **Smart Batch** with concurrency ${concurrency2} for ${timeDiff}s improvement.`;
    },
  });

/**
 * Factory to create all batch tools
 */
export function createBatchTools(
  parallelAgentManager: ParallelAgentManager,
  client?: unknown,
): Record<string, ReturnType<typeof tool>> {
  return {
    process_batch: createProcessBatchTool(parallelAgentManager, client),
    export_failed_tasks: createExportFailedTasksTool(parallelAgentManager),
    compare_strategies: createCompareStrategiesTool(parallelAgentManager),
  };
}
