/**
 * Task Launcher - Handles launching new parallel tasks
 */

import type { PluginInput } from "@opencode-ai/plugin";
import {
  ID_PREFIX,
  TASK_STATUS,
  PART_TYPES,
  PARALLEL_TASK,
} from "../../../shared/index.js";
import { ConcurrencyController } from "../concurrency.js";
import { TaskStore } from "../task-store.js";
import { presets } from "../../notification/toast.js";
import { getTaskToastManager } from "../../notification/task-toast-manager.js";
import type { LaunchInput, ParallelTask } from "../../../shared/index.js";

import { SessionPool } from "../session-pool.js";
import { handleError } from "../../recovery/auto-recovery.js";
import type { ErrorContext } from "../../recovery/auto-recovery.js";
import { log } from "../logger.js";
import { taskPool } from "../../pool/task-pool.js";
import { buildRoutedAgentPrompt } from "./prompt-routing.js";
import { withTimeout } from "../../queue/async-utils.js";

type OpencodeClient = PluginInput["client"];
export type LaunchResult = ParallelTask | ParallelTask[] | null;

export class TaskLauncher {

  constructor(
    private client: OpencodeClient,
    private store: TaskStore,
    private concurrency: ConcurrencyController,
    private sessionPool: SessionPool,
    private onTaskError: (taskId: string, error: unknown) => void | Promise<void>,
    private startPolling: () => void,
  ) { }

  /**
   * Unified launch method - handles both single and multiple tasks efficiently.
   * All session creations happen in parallel immediately.
   * Concurrency acquisition and prompt firing happen in the background.
   */
  async launch(
    inputs: LaunchInput | LaunchInput[],
  ): Promise<LaunchResult> {
    const isArray = Array.isArray(inputs);
    const taskInputs = isArray ? inputs : [inputs];

    if (taskInputs.length === 0) {
      throw new Error("Cannot launch tasks: empty input array");
    }

    // EXECUTION STRATEGY:
    // 1. Create and prepare sessions/tasks
    // 2. Background process execution

    const tasks = await Promise.all(
      taskInputs.map((input) => this.prepareTask(input).catch(() => null)),
    );

    const successfulTasks = tasks.filter((t): t is ParallelTask => t !== null);

    // Start background execution for each task
    successfulTasks.forEach((task) => {
      this.executeBackground(task).catch(async (error) => {
        try {
          await this.onTaskError(task.id, error);
        } catch (handlerError) {
          log(`[TaskLauncher] Task error handler failed for ${task.id}: ${handlerError}`);
        }
      });
    });

    // Start polling if we have running/pending tasks
    if (successfulTasks.length > 0) {
      this.startPolling();
    }

    return isArray ? successfulTasks : successfulTasks[0] || null;
  }

  /**
   * Prepare task: Create session and registration without blocking on concurrency
   */
  private async prepareTask(input: LaunchInput): Promise<ParallelTask> {
    // HPFA: Depth Guard
    const currentDepth = input.depth ?? 0;
    if (currentDepth >= PARALLEL_TASK.MAX_DEPTH) {
      throw new Error(
        `Maximum task depth (${PARALLEL_TASK.MAX_DEPTH}) reached. To prevent infinite recursion, no further sub-tasks can be spawned.`,
      );
    }

    // Use SessionPool to acquire or create session
    const session = await this.sessionPool.acquire(
      input.agent,
      input.parentSessionID,
      input.description,
    );

    const sessionID = session.id;
    const taskId = `${ID_PREFIX.TASK}${crypto.randomUUID().slice(0, 8)}`;

    // Use task pool for memory efficiency
    const task = taskPool.acquire();

    // Initialize task fields
    task.id = taskId;
    task.sessionID = sessionID;
    task.parentSessionID = input.parentSessionID;
    task.description = input.description;
    task.prompt = input.prompt;
    task.agent = input.agent;
    task.status = TASK_STATUS.PENDING;
    task.startedAt = new Date();
    task.concurrencyKey = input.agent;
    task.depth = (input.depth ?? 0) + 1;
    task.mode = input.mode || "normal";
    task.groupID = input.groupID;

    // State tracking
    this.store.set(taskId, task);
    this.store.trackPending(input.parentSessionID, taskId);


    // Registry in Toast & UI
    const toastManager = getTaskToastManager();
    if (toastManager) {
      toastManager.addTask({
        id: taskId,
        description: input.description,
        agent: input.agent,
        isBackground: true,
        parentSessionID: input.parentSessionID,
        sessionID,
      });
    }
    presets.sessionCreated(sessionID, input.agent);

    return task;
  }

  /**
   * Background execution: Acquire slot and fire prompt with auto-retry
   */
  private async executeBackground(task: ParallelTask): Promise<void> {
    let attempt = 1;
    const token = await this.concurrency.acquireToken(task.agent);

    try {
      while (true) {
        try {
          // 1. Update status to RUNNING
          task.status = TASK_STATUS.RUNNING;
          task.startedAt = new Date();
          this.store.set(task.id, task);
          // WAL already logged in prepareTask - skip duplicate

          // 2. Fire prompt with timeout
          const routedPrompt = await buildRoutedAgentPrompt(task.agent, task.prompt);

          const promptPromise = this.client.session.prompt({
            path: { id: task.sessionID },
            body: {
              agent: routedPrompt.wireAgent,
              tools: routedPrompt.tools,
              parts: [{ type: PART_TYPES.TEXT, text: routedPrompt.text }],
            },
          });

          await withTimeout(
            promptPromise,
            600_000,
            "Session prompt execution timed out after 600s",
          );

          // Success! Exit loop
          return;
        } catch (error) {
          // Auto-recovery logic
          const context: ErrorContext = {
            sessionId: task.sessionID,
            taskId: task.id,
            agent: task.agent,
            error: error instanceof Error ? error : new Error(String(error)),
            attempt,
            timestamp: new Date(),
          };

          const action = handleError(context);

          if (action.type === "retry") {
            log(
              `[AutoRetry] Task ${task.id} failed (attempt ${attempt}). Retrying in ${action.delay}ms...`,
            );

            // Adjust prompt if strategy suggests it
            if (action.modifyPrompt) {
              task.prompt += `\n\n${action.modifyPrompt}`;
            }

            await new Promise((r) => setTimeout(r, action.delay));
            attempt++;
            continue;
          }

          // Cannot retry or max attempts reached
          throw error;
        }
      }
    } finally {
      // GUARANTEED cleanup: RAII pattern via ConcurrencyToken
      token.release();
    }
  }
}
