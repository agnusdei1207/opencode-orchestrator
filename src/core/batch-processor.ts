/**
 * Smart Batch Processor - Centralized validation and retry
 *
 * Strategy: Execute all tasks → Centralized validation → Retry only failures
 * This is more efficient than naive parallelism because:
 * 1. Failed tasks are batch-identified and retried
 * 2. No redundant work on already-successful tasks
 * 3. Validation happens once, not per-task
 */

import type { ParallelAgentManager } from "./async-agent.js";

export interface BatchTask {
  id: string;
  description: string;
  agent: string;
  prompt: string;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempts: number;
  error?: string;
}

export interface BatchResult {
  total: number;
  success: number;
  failed: number;
  retried: number;
  duration: number;
  tasks: BatchTask[];
}

export interface BatchProcessorOptions {
  concurrency: number;
  maxRetries: number;
  validateAfterEach?: boolean;
  continueOnError?: boolean;
}

export class SmartBatchProcessor {
  private parallelAgentManager: ParallelAgentManager;
  private tasks: Map<string, BatchTask> = new Map();

  constructor(parallelAgentManager: ParallelAgentManager) {
    this.parallelAgentManager = parallelAgentManager;
  }

  /**
   * Process a batch of tasks with smart validation
   */
  async processBatch(
    tasks: BatchTask[],
    options: BatchProcessorOptions = {
      concurrency: 3,
      maxRetries: 2,
      validateAfterEach: false,
      continueOnError: true,
    }
  ): Promise<BatchResult> {
    const startTime = Date.now();

    // Initialize tasks
    for (const task of tasks) {
      this.tasks.set(task.id, {
        ...task,
        status: 'pending',
        attempts: 0,
      });
    }

    console.log(`\n📦 [Smart Batch] Starting ${tasks.length} tasks with concurrency ${options.concurrency}`);
    console.log(`   Strategy: ${options.validateAfterEach ? 'Validate each' : 'Centralized validation'}`);

    // Phase 1: Initial execution
    await this.executePhase(tasks, options, 'initial');

    // Phase 2: Centralized validation
    const failedTasks = Array.from(this.tasks.values())
      .filter((t) => t.status === 'failed' || t.status === 'pending');

    if (failedTasks.length === 0) {
      console.log(`\n✅ [Smart Batch] All ${tasks.length} tasks succeeded!`);
      return this.buildResult(startTime, tasks);
    }

    console.log(`\n🔍 [Smart Batch] Validation complete: ${failedTasks.length}/${tasks.length} tasks need retry`);

    // Phase 3: Retry only failed tasks
    let retryCount = 0;
    while (failedTasks.length > 0 && retryCount < options.maxRetries) {
      retryCount++;

      console.log(`\n🔄 [Smart Batch] Retry round ${retryCount}/${options.maxRetries} for ${failedTasks.length} tasks`);

      await this.executePhase(failedTasks, options, `retry-${retryCount}`);

      const stillFailed = Array.from(this.tasks.values())
        .filter((t) => t.status === 'failed');

      if (stillFailed.length === failedTasks.length) {
        console.log(`⚠️ [Smart Batch] No progress in retry round ${retryCount}, stopping`);
        break;
      }
    }

    return this.buildResult(startTime, tasks);
  }

  /**
   * Execute a phase with concurrency control
   */
  private async executePhase(
    tasks: BatchTask[],
    options: BatchProcessorOptions,
    phase: string
  ): Promise<void> {
    // Update concurrency for this phase
    for (const task of tasks) {
      this.parallelAgentManager.setConcurrencyLimit(task.agent, options.concurrency);
    }

    // Create batches based on concurrency
    const batches: BatchTask[][] = [];
    for (let i = 0; i < tasks.length; i += options.concurrency) {
      batches.push(tasks.slice(i, i + options.concurrency));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`   [${phase}] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} tasks)`);

      // Execute batch in parallel
      const batchPromises = batch.map((task) => this.executeTask(task, options));
      await Promise.all(batchPromises);

      // If centralized validation, skip per-task validation
      if (!options.validateAfterEach) {
        continue;
      }

      // Validate and retry failed tasks immediately
      const failedInBatch = batch.filter((t) => t.status === 'failed');
      if (failedInBatch.length > 0) {
        console.log(`   [${phase}] ${failedInBatch.length} failed in batch, immediate retry`);
        const retryPromises = failedInBatch.map((t) => this.executeTask(t, options));
        await Promise.all(retryPromises);
      }
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(
    task: BatchTask,
    options: BatchProcessorOptions
  ): Promise<void> {
    const currentTask = this.tasks.get(task.id)!;

    if (!options.continueOnError && currentTask.status === 'failed') {
      return;
    }

    try {
      currentTask.attempts++;
      currentTask.status = 'pending';

      // Launch task
      const launched = await this.parallelAgentManager.launch({
        agent: task.agent,
        description: task.description,
        prompt: task.prompt,
        parentSessionID: '', // Would need actual parent ID
      });

      // Wait for completion
      const maxWaitTime = 5 * 60 * 1000; // 5 minutes per task
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        const taskData = this.parallelAgentManager.getTask(launched.id);
        if (!taskData) break;

        if (taskData.status === 'completed') {
          currentTask.status = 'success';
          console.log(`   ✅ [${task.id}] Success on attempt ${currentTask.attempts}`);
          return;
        }

        if (taskData.status === 'error' || taskData.status === 'timeout') {
          currentTask.status = 'failed';
          currentTask.error = taskData.error || 'Unknown error';
          console.log(`   ❌ [${task.id}] Failed: ${currentTask.error}`);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      currentTask.status = 'failed';
      currentTask.error = 'Timeout';
    } catch (error) {
      currentTask.status = 'failed';
      currentTask.error = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ [${task.id}] Exception: ${currentTask.error}`);
    }
  }

  /**
   * Build result summary
   */
  private buildResult(startTime: number, tasks: BatchTask[]): BatchResult {
    const allTasks = Array.from(this.tasks.values());

    const successCount = allTasks.filter((t) => t.status === 'success').length;
    const failedCount = allTasks.filter((t) => t.status === 'failed').length;
    const retriedCount = allTasks.filter((t) => t.attempts > 1).length;

    return {
      total: tasks.length,
      success: successCount,
      failed: failedCount,
      retried: retriedCount,
      duration: Date.now() - startTime,
      tasks: allTasks,
    };
  }

  /**
   * Export failed tasks for manual review
   */
  exportFailedTasks(): string {
    const failedTasks = Array.from(this.tasks.values())
      .filter((t) => t.status === 'failed');

    if (failedTasks.length === 0) {
      return '✅ No failed tasks to export.';
    }

    const output = failedTasks.map((task) => {
      return `
---
Task ID: ${task.id}
Agent: ${task.agent}
Attempts: ${task.attempts}
Error: ${task.error}
Description: ${task.description}
---
      `.trim();
    }).join('\n');

    return `❌ ${failedTasks.length} failed tasks:\n${output}`;
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.tasks.clear();
  }
}
