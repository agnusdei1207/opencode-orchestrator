import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import type { ParallelAgentManager } from "../../core/agents/manager.js";
import { presets } from "../../core/notification/toast.js";
import { PARALLEL_TASK, TASK_STATUS, type ParallelTask } from "../../shared/index.js";
import { DELEGATE_TASK_ARGS, DELEGATE_TASK_DESCRIPTION } from "./delegate-task-metadata.js";

type DelegateMode = "normal" | "race" | "fractal";
interface DelegateArgs {
    agent: string;
    description: string;
    prompt: string;
    background: boolean;
    resume?: string;
    mode?: DelegateMode;
    groupID?: string;
}

function readString(args: Record<string, unknown>, key: string, optional = false): string | undefined {
    const value = args[key];
    if (optional && value === undefined) return undefined;
    if (typeof value !== "string" || !value.trim()) throw new Error(`'${key}' must be a non-empty string`);
    return value;
}

function readArgs(args: Record<string, unknown>): DelegateArgs {
    if (typeof args.background !== "boolean") throw new Error("'background' parameter is REQUIRED and must be a boolean");
    const mode = readString(args, "mode", true);
    if (mode !== undefined && mode !== "normal" && mode !== "race" && mode !== "fractal") {
        throw new Error("'mode' must be one of: normal, race, fractal");
    }
    return {
        agent: readString(args, "agent")!, description: readString(args, "description")!,
        prompt: readString(args, "prompt")!, background: args.background,
        resume: readString(args, "resume", true), mode,
        groupID: readString(args, "groupID", true),
    };
}

function identity(task: ParallelTask): string {
    return `Task: \`${task.id}\`` + (task.sessionID ? `\nSession: \`${task.sessionID}\` (save for resume)` : "\nSession is pending.");
}

function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.resolve();
    return new Promise((resolve) => {
        const finish = () => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", finish);
            resolve();
        };
        const timer = setTimeout(finish, ms);
        signal?.addEventListener("abort", finish, { once: true });
    });
}

async function readResultWithinWait(manager: ParallelAgentManager, taskID: string, deadline: number, signal?: AbortSignal): Promise<string | null> {
    const cleanup = new AbortController();
    const waitSignal = AbortSignal.any(signal ? [signal, cleanup.signal] : [cleanup.signal]);
    try {
        return await Promise.race([
            manager.getResult(taskID),
            delay(Math.max(0, deadline - Date.now()), waitSignal).then(() => {
                throw new Error(signal?.aborted ? "Polling aborted" : "Result wait timed out");
            }),
        ]);
    } finally {
        cleanup.abort();
    }
}

// The manager owns completion. A synchronous tool only waits for that same result.
async function waitForTask(manager: ParallelAgentManager, task: ParallelTask, signal?: AbortSignal): Promise<string> {
    const startedAt = task.startedAt;
    const deadline = Date.now() + PARALLEL_TASK.SYNC_TIMEOUT_MS;
    while (Date.now() < deadline) {
        if (signal?.aborted) return `[ERROR] Polling aborted\n${identity(task)}\nUse get_task_result later.`;
        const current = manager.getTask(task.id);
        if (!current || current.startedAt !== startedAt) return `[ERROR] Task state changed or is unavailable\n${identity(task)}`;
        if (current.status === TASK_STATUS.COMPLETED) {
            try {
                const result = await readResultWithinWait(manager, task.id, deadline, signal);
                if (signal?.aborted || manager.getTask(task.id) !== current || current.startedAt !== startedAt || current.status !== TASK_STATUS.COMPLETED) {
                    return `[ERROR] Task changed or wait interrupted during result retrieval\n${identity(task)}`;
                }
                return `[DONE]\n${identity(task)}\n\n${result || "(No output)"}`;
            } catch (error) {
                return `[ERROR] Result unavailable: ${errorText(error)}\n${identity(task)}`;
            }
        }
        if (current.status !== TASK_STATUS.PENDING && current.status !== TASK_STATUS.RUNNING) {
            return `[${current.status.toUpperCase()}] ${current.error || "Task did not complete"}\n${identity(task)}`;
        }
        await delay(PARALLEL_TASK.POLL_INTERVAL_MS, signal);
    }
    return `[TIMEOUT] Waiting for task completion\n${identity(task)}\nUse get_task_result or resume later.`;
}

async function dispatch(manager: ParallelAgentManager, args: DelegateArgs, parentSessionID: string, depth: number): Promise<ParallelTask | null> {
    if (args.resume) return manager.resume({ sessionId: args.resume, prompt: args.prompt, parentSessionID });
    const result = await manager.launch({
        agent: args.agent, description: args.description, prompt: args.prompt,
        parentSessionID, depth, mode: args.mode, groupID: args.groupID,
    });
    return Array.isArray(result) ? result[0] ?? null : result ?? null;
}

export const createDelegateTaskTool = (manager: ParallelAgentManager): ToolDefinition => tool({
    description: DELEGATE_TASK_DESCRIPTION,
    args: DELEGATE_TASK_ARGS,
    async execute(rawArgs, context) {
        if (context.abort?.aborted) return "[ERROR] Delegation aborted before dispatch.";
        let args: DelegateArgs;
        try { args = readArgs(rawArgs); }
        catch (error) { return `[ERROR] Invalid arguments: ${errorText(error)}`; }
        const depth = manager.getTaskBySession(context.sessionID)?.depth ?? 0;
        if (depth >= PARALLEL_TASK.TERMINAL_DEPTH) {
            return `[ERROR] Delegation blocked: You are a terminal node (depth ${depth}). Report blockers to Commander and complete your assigned scope directly.`;
        }
        try {
            const task = await dispatch(manager, args, context.sessionID, depth);
            if (!task) return `[ERROR] Failed to launch task: ${args.description}`;
            if (args.background) {
                if (!args.resume) presets.taskStarted(task.id, args.agent);
                return `[${args.resume ? "RESUME" : "SPAWNED"}] ${identity(task)}`;
            }
            const result = await waitForTask(manager, task, context.abort);
            return args.resume ? result.replace(/^\[DONE\]/, "[RESUMED & DONE]") : result;
        } catch (error) {
            return `[ERROR] ${args.resume ? "Resume failed" : "Failed"}: ${errorText(error)}`;
        }
    },
});
