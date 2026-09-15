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
import { log } from "../logger.js";
import { acquireParallelTask } from "../../pool/task-pool.js";
import { buildRoutedAgentPrompt, type RoutedAgentPrompt } from "./prompt-routing.js";
import { syntheticTextPart } from "../../session/injection.js";
import { isSessionBusy } from "../../session/activity.js";

type OpencodeClient = PluginInput["client"];
export type LaunchResult = ParallelTask | ParallelTask[] | null;
type PrepareTaskResult =
  | { task: ParallelTask }
  | { input: LaunchInput; error: unknown };

interface TaskLauncherOptions {
  client: OpencodeClient;
  store: TaskStore;
  concurrency: ConcurrencyController;
  sessionPool: SessionPool;
  onTaskError: (taskId: string, error: unknown) => void | Promise<void>;
  startPolling: () => void;
}

export class TaskLauncher {
  private readonly shutdownController = new AbortController();
  private readonly client: OpencodeClient;
  private readonly store: TaskStore;
  private readonly concurrency: ConcurrencyController;
  private readonly sessionPool: SessionPool;
  private readonly onTaskError: TaskLauncherOptions["onTaskError"];
  private readonly startPolling: () => void;

  constructor(options: TaskLauncherOptions) {
    this.client = options.client;
    this.store = options.store;
    this.concurrency = options.concurrency;
    this.sessionPool = options.sessionPool;
    this.onTaskError = options.onTaskError;
    this.startPolling = options.startPolling;
  }

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

    const tasks = await Promise.all(taskInputs.map((input) => this.prepareTaskResult(input)));

    const successfulTasks = tasks.flatMap((result) => "task" in result ? [result.task] : []);

    // Start background execution for each task
    successfulTasks.forEach((task) => this.startTask(task));

    return isArray ? successfulTasks : successfulTasks[0] || null;
  }

  shutdown(): void {
    this.shutdownController.abort();
  }

  startTask(task: ParallelTask, routedPrompt?: RoutedAgentPrompt): void {
    const startedAt = task.startedAt;
    this.executeBackground(task, routedPrompt).catch(async (error) => {
      if (task.startedAt !== startedAt || !isActive(task)) return;
      try {
        await this.onTaskError(task.id, error);
      } catch (handlerError) {
        log(`[TaskLauncher] Task error handler failed for ${task.id}: ${handlerError}`);
      }
    });
    this.startPolling();
  }

  /**
   * Prepare task: Create session and registration without blocking on concurrency
   */
  private async prepareTaskResult(input: LaunchInput): Promise<PrepareTaskResult> {
    try {
      return { task: await this.prepareTask(input) };
    } catch (error) {
      log(`[TaskLauncher] Failed to prepare task for ${input.agent}: ${input.description}`, error);
      return { input, error };
    }
  }

  private async prepareTask(input: LaunchInput): Promise<ParallelTask> {
    const childDepth = resolveChildDepth(input.depth);

    // Use SessionPool to acquire or create session
    const session = await this.sessionPool.acquire(
      input.agent,
      input.parentSessionID,
      input.description,
    );

    const sessionID = session.id;
    const taskId = `${ID_PREFIX.TASK}${crypto.randomUUID().slice(0, 8)}`;

    const task = acquireParallelTask({
      id: taskId,
      sessionID,
      parentSessionID: input.parentSessionID,
      description: input.description,
      prompt: input.prompt,
      agent: input.agent,
      depth: childDepth,
      mode: input.mode,
      groupID: input.groupID,
    });

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

  private async executeBackground(task: ParallelTask, preparedPrompt?: RoutedAgentPrompt): Promise<void> {
    const startedAt = task.startedAt;
    await this.concurrency.acquire(task.agent);
    if (!isActive(task) || task.startedAt !== startedAt || this.shutdownController.signal.aborted) {
      this.concurrency.release(task.agent);
      return;
    }
    task.concurrencyKey = task.agent;
    const routedPrompt = preparedPrompt ?? await buildRoutedAgentPrompt(task.agent, task.prompt);
    if (!isActive(task) || task.startedAt !== startedAt) return;
    if (preparedPrompt && await isSessionBusy(this.client, task.sessionID)) {
      throw new Error("Resume session became busy before dispatch");
    }
    if (!isActive(task) || task.startedAt !== startedAt) return;
    task.status = TASK_STATUS.RUNNING;
    this.store.set(task.id, task);
    await this.sendPrompt(task, routedPrompt, Boolean(preparedPrompt));
  }

  private async sendPrompt(task: ParallelTask, prompt: RoutedAgentPrompt, synthetic: boolean): Promise<void> {
    const promptAbort = new AbortController();
    const unlinkShutdown = linkAbortSignal(this.shutdownController.signal, promptAbort);
    try {
      const response = await withAbortableTimeout(this.client.session.prompt({
        path: { id: task.sessionID },
        body: {
          agent: prompt.wireAgent,
          tools: prompt.tools,
          parts: [synthetic ? syntheticTextPart(prompt.text) : { type: PART_TYPES.TEXT, text: prompt.text }],
        },
        signal: promptAbort.signal,
      }), 600_000, "Session prompt execution timed out after 600s", promptAbort);
      if (response.error) throw new Error(String(response.error));
      if (response.data?.info?.error) throw new Error(JSON.stringify(response.data.info.error));
    } finally {
      unlinkShutdown();
    }
  }
}
function isActive(task: ParallelTask): boolean {
  return task.status === TASK_STATUS.PENDING || task.status === TASK_STATUS.RUNNING;
}

function resolveChildDepth(parentDepth = 0): number {
  if (parentDepth >= PARALLEL_TASK.MAX_DEPTH) {
    throw new Error(
      `Maximum task depth (${PARALLEL_TASK.MAX_DEPTH}) reached. To prevent infinite recursion, no further sub-tasks can be spawned.`,
    );
  }

  return parentDepth + 1;
}

async function withAbortableTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
  abort: AbortController,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      abort.abort();
      reject(new Error(errorMessage));
    }, timeoutMs);
    timeoutId.unref?.();
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function linkAbortSignal(source: AbortSignal, target: AbortController): () => void {
  if (source.aborted) {
    target.abort();
    return () => { };
  }

  const onAbort = () => target.abort();
  source.addEventListener("abort", onAbort, { once: true });
  return () => source.removeEventListener("abort", onAbort);
}
