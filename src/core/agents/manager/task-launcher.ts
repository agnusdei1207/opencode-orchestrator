/**
 * Task Launcher - creates a delegated session and dispatches its prompt.
 */

import type { HostClient } from "../../../host/client.js";
import { ID_PREFIX, TASK_STATUS, PARALLEL_TASK } from "../../../shared/index.js";
import type { LaunchInput, ParallelTask } from "../../../shared/index.js";
import { ConcurrencyController } from "../concurrency.js";
import { TaskStore } from "../task-store.js";
import { SessionRegistry } from "../session-registry.js";
import { log } from "../logger.js";
import type { RoutedAgentPrompt } from "./prompt-routing.js";
import { isSessionBusy } from "../../session/activity.js";

interface TaskLauncherOptions {
  client: HostClient;
  store: TaskStore;
  concurrency: ConcurrencyController;
  sessionRegistry: SessionRegistry;
  onTaskError: (taskId: string, error: unknown) => void | Promise<void>;
  startPolling: () => void;
  /** Builds the delegated prompt from this project's agents and memory. */
  routePrompt: (agent: string, prompt: string) => Promise<RoutedAgentPrompt>;
}

export class TaskLauncher {
  private readonly shutdownController = new AbortController();

  constructor(private readonly options: TaskLauncherOptions) { }

  /** Create the child session and start the task. Errors carry their cause to the caller. */
  async launch(input: LaunchInput): Promise<ParallelTask> {
    const depth = resolveChildDepth(input.depth);
    const session = await this.options.sessionRegistry.acquire(input.agent, input.parentSessionID, input.description);
    const task: ParallelTask = {
      id: `${ID_PREFIX.TASK}${crypto.randomUUID().slice(0, 8)}`,
      sessionID: session.id,
      parentSessionID: input.parentSessionID,
      description: input.description,
      prompt: input.prompt,
      agent: input.agent,
      status: TASK_STATUS.PENDING,
      startedAt: new Date(),
      depth,
    };
    this.options.store.set(task.id, task);
    this.options.store.trackPending(input.parentSessionID, task.id);
    this.startTask(task);
    return task;
  }

  shutdown(): void {
    this.shutdownController.abort();
  }

  startTask(task: ParallelTask, routedPrompt?: RoutedAgentPrompt): void {
    const startedAt = task.startedAt;
    this.executeBackground(task, routedPrompt).catch(async (error) => {
      if (task.startedAt !== startedAt || !isActive(task)) return;
      try {
        await this.options.onTaskError(task.id, error);
      } catch (handlerError) {
        log(`[TaskLauncher] Task error handler failed for ${task.id}: ${handlerError}`);
      }
    });
    this.options.startPolling();
  }

  private async executeBackground(task: ParallelTask, preparedPrompt?: RoutedAgentPrompt): Promise<void> {
    const { concurrency, client, store } = this.options;
    const startedAt = task.startedAt;
    await concurrency.acquire(task.agent);
    if (!isSameActiveRun(task, startedAt) || this.shutdownController.signal.aborted) {
      concurrency.release(task.agent);
      return;
    }
    task.concurrencyKey = task.agent;
    const routedPrompt = preparedPrompt ?? await this.options.routePrompt(task.agent, task.prompt);
    if (!isSameActiveRun(task, startedAt)) return;
    if (preparedPrompt && await isSessionBusy(client, task.sessionID)) {
      throw new Error("Resume session became busy before dispatch");
    }
    if (!isSameActiveRun(task, startedAt)) return;
    task.status = TASK_STATUS.RUNNING;
    store.set(task.id, task);
    // A resumed task continues an existing conversation, so its prompt is
    // orchestrator-authored. A new session's opening instruction is not
    // synthetic: OpenCode names the session after it.
    await client.prompt({
      sessionID: task.sessionID,
      agent: routedPrompt.wireAgent,
      text: routedPrompt.text,
      synthetic: Boolean(preparedPrompt),
    });
  }
}

function isActive(task: ParallelTask): boolean {
  return task.status === TASK_STATUS.PENDING || task.status === TASK_STATUS.RUNNING;
}

/** True while the task is still active and has not been restarted since `startedAt` was captured. */
function isSameActiveRun(task: ParallelTask, startedAt: ParallelTask["startedAt"]): boolean {
  return isActive(task) && task.startedAt === startedAt;
}

function resolveChildDepth(parentDepth = 0): number {
  if (parentDepth >= PARALLEL_TASK.MAX_DEPTH) {
    throw new Error(
      `Maximum task depth (${PARALLEL_TASK.MAX_DEPTH}) reached. To prevent infinite recursion, no further sub-tasks can be spawned.`,
    );
  }
  return parentDepth + 1;
}
