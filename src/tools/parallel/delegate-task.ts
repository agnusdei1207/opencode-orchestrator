/**
 * delegate_task Tool
 * 
 * Delegate work to an agent (sync or background mode)
 * Supports resuming existing sessions for context preservation
 * 
 * Safety features:
 * - Maximum poll count to prevent infinite loops
 * - Timeout guarantee with graceful degradation
 * - Resource cleanup on all exit paths
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import { ParallelAgentManager } from "../../core/agents/index.js";
import { log } from "../../core/agents/logger.js";
import { presets } from "../../core/notification/toast.js";
import {
    PARALLEL_TASK,
    PART_TYPES,
    MESSAGE_ROLES,
    SESSION_STATUS,
    PARALLEL_LOG,
    OUTPUT_LABEL,
    AGENT_NAMES,
    PROMPT_TAGS,
    PARALLEL_PARAMS,
    TOOL_NAMES,
    type SessionClient,
    type PollResult,
    type ParallelTask,
} from "../../shared/index.js";


// ============================================================
// Safety Constants (from shared constants for consistency)
// ============================================================
const MIN_IDLE_TIME_MS = PARALLEL_TASK.MIN_IDLE_TIME_MS;
const POLL_INTERVAL_MS = PARALLEL_TASK.POLL_INTERVAL_MS;
const SYNC_TIMEOUT_MS = PARALLEL_TASK.SYNC_TIMEOUT_MS;
const MAX_POLL_COUNT = PARALLEL_TASK.MAX_POLL_COUNT;
const STABLE_POLLS_REQUIRED = PARALLEL_TASK.STABLE_POLLS_REQUIRED;
const POLL_LOG_INTERVAL_MS = 10_000;

// Session client interface and Poll result interface are now imported from shared

type DelegateMode = "normal" | "race" | "fractal";

interface SessionMessagePart {
    type?: string;
    text?: string;
    tool?: string;
}

interface SessionMessage {
    info?: { role?: string };
    parts?: SessionMessagePart[];
}

interface PollState {
    pollCount: number;
    stablePolls: number;
    lastMsgCount: number;
    hasValidOutput: boolean;
    lastLogTime: number;
}

interface DelegateTaskArgs {
    agent: string;
    description: string;
    prompt: string;
    background?: boolean;
    resume?: string;
    mode?: DelegateMode;
    groupID?: string;
}

interface DelegateTaskContext {
    sessionID: string;
    abort?: AbortSignal;
}

interface DelegateTaskRuntime {
    manager: ParallelAgentManager;
    session: SessionClient;
    ctx: DelegateTaskContext;
    args: DelegateTaskArgs;
    parentDepth: number;
    abort?: AbortSignal;
}

const DELEGATE_TASK_DESCRIPTION = `Delegate a task to an agent.

${PROMPT_TAGS.MODE.open}
- ${PARALLEL_PARAMS.BACKGROUND}=true: Non-blocking. Returns task ID immediately.
- ${PARALLEL_PARAMS.BACKGROUND}=false: Blocking. Waits for result.
${PROMPT_TAGS.MODE.close}

${PROMPT_TAGS.RESUME.open}
- ${PARALLEL_PARAMS.RESUME}: Optional session ID to continue existing session.
- When set, continues previous work instead of starting fresh.
- Preserves all context from previous conversation.
- Use for: retry after failure, follow-up questions, token efficiency.
${PROMPT_TAGS.RESUME.close}

${PROMPT_TAGS.SAFETY.open}
- Max 10 tasks per agent type (configurable)
- Auto-timeout: 60 minutes
- Use \`${TOOL_NAMES.LIST_AGENTS}\` to see all available agents (including custom ones).
${PROMPT_TAGS.SAFETY.close}`;

const DELEGATE_TASK_ARGS = {
    [PARALLEL_PARAMS.AGENT]: tool.schema.string().describe("Agent name"),
    [PARALLEL_PARAMS.DESCRIPTION]: tool.schema.string().describe("Task description"),
    [PARALLEL_PARAMS.PROMPT]: tool.schema.string().describe("Prompt for the agent"),
    [PARALLEL_PARAMS.BACKGROUND]: tool.schema.boolean().describe("true=async, false=sync"),
    [PARALLEL_PARAMS.RESUME]: tool.schema.string().optional().describe("Session ID to resume (from previous task.sessionID)"),
    [PARALLEL_PARAMS.MODE]: tool.schema.enum(["normal", "race", "fractal"]).optional().describe("Task mode (race=first wins, fractal=recursive)"),
    [PARALLEL_PARAMS.GROUP_ID]: tool.schema.string().optional().describe("Group ID for racing or tracking recursive families"),
};


/**
 * Validate that a session has actual output before marking complete.
 * Prevents premature completion when session.idle fires before agent responds.
 */
async function validateSessionHasOutput(
    session: Pick<SessionClient, 'messages'>,
    sessionID: string
): Promise<boolean> {
    try {
        const messages = await readSessionMessages(session, sessionID);
        return hasValidAssistantOutput(messages);
    } catch (error) {
        log(`${PARALLEL_LOG.DELEGATE_TASK} Error validating session output:`, error);
        return false;
    }
}

// PollResult is now imported from shared

async function readSessionMessages(
    session: Pick<SessionClient, 'messages'>,
    sessionID: string,
): Promise<SessionMessage[]> {
    const response = await session.messages({ path: { id: sessionID } });
    return (response.data ?? []) as SessionMessage[];
}

function hasAssistantMessage(messages: SessionMessage[]): boolean {
    return messages.some((message) => message.info?.role === MESSAGE_ROLES.ASSISTANT);
}

function hasAssistantContent(messages: SessionMessage[]): boolean {
    return messages.some((message) =>
        message.info?.role === MESSAGE_ROLES.ASSISTANT &&
        (message.parts ?? []).some(hasOutputPart)
    );
}

function hasValidAssistantOutput(messages: SessionMessage[]): boolean {
    return hasAssistantMessage(messages) && hasAssistantContent(messages);
}

function hasOutputPart(part: SessionMessagePart): boolean {
    return hasTextOutput(part) || part.type === PART_TYPES.TOOL || part.type === PART_TYPES.TOOL_USE || Boolean(part.tool);
}

function hasTextOutput(part: SessionMessagePart): boolean {
    const isText = part.type === PART_TYPES.TEXT || part.type === PART_TYPES.REASONING;
    return isText && Boolean(part.text?.trim());
}

/**
 * Safe polling with hard limits to prevent infinite loops.
 * Returns structured result with diagnostics.
 */
async function pollWithSafetyLimits(
    session: SessionClient,
    sessionID: string,
    startTime: number,
    abort?: AbortSignal,
): Promise<PollResult> {
    const state = createPollState();

    while (state.pollCount < MAX_POLL_COUNT) {
        state.pollCount++;
        let elapsed = Date.now() - startTime;

        if (elapsed >= SYNC_TIMEOUT_MS) {
            return buildTimeoutResult(state, elapsed);
        }

        logPollingProgress(state, elapsed);
        if (await delay(POLL_INTERVAL_MS, abort)) {
            return buildAbortedResult(state, Date.now() - startTime);
        }
        elapsed = Date.now() - startTime;

        const result = await pollSessionOnce(session, sessionID, state, elapsed);
        if (result) return result;
    }

    const elapsed = Date.now() - startTime;
    log(`${PARALLEL_LOG.DELEGATE_TASK} Max poll count reached`, { pollCount: state.pollCount, elapsed });
    return {
        success: false,
        timedOut: true,
        error: "Max poll count exceeded",
        pollCount: state.pollCount,
        elapsedMs: elapsed
    };
}

function createPollState(): PollState {
    return {
        pollCount: 0,
        stablePolls: 0,
        lastMsgCount: 0,
        hasValidOutput: false,
        lastLogTime: 0,
    };
}

function buildAbortedResult(state: PollState, elapsed: number): PollResult {
    log(`${PARALLEL_LOG.DELEGATE_TASK} Polling aborted`, {
        pollCount: state.pollCount,
        elapsed,
    });
    return {
        success: false,
        timedOut: false,
        aborted: true,
        error: "Polling aborted",
        pollCount: state.pollCount,
        elapsedMs: elapsed,
    };
}

function buildTimeoutResult(state: PollState, elapsed: number): PollResult {
    log(`${PARALLEL_LOG.DELEGATE_TASK} Hard timeout reached`, {
        pollCount: state.pollCount,
        elapsed,
    });
    return { success: false, timedOut: true, pollCount: state.pollCount, elapsedMs: elapsed };
}

function logPollingProgress(state: PollState, elapsed: number): void {
    if (Date.now() - state.lastLogTime <= POLL_LOG_INTERVAL_MS) return;

    log(`${PARALLEL_LOG.DELEGATE_TASK} Polling...`, {
        pollCount: state.pollCount,
        elapsed: Math.floor(elapsed / 1000) + "s",
        stablePolls: state.stablePolls,
        hasValidOutput: state.hasValidOutput
    });
    state.lastLogTime = Date.now();
}

async function pollSessionOnce(
    session: SessionClient,
    sessionID: string,
    state: PollState,
    elapsed: number,
): Promise<PollResult | null> {
    try {
        const statusResult = await session.status();
        const sessionStatus = statusResult.data?.[sessionID];

        if (!sessionStatus || sessionStatus.type !== SESSION_STATUS.IDLE) {
            state.stablePolls = 0;
            return null;
        }

        if (elapsed < MIN_IDLE_TIME_MS) {
            return null;
        }

        const messages = await readSessionMessages(session, sessionID);
        const outputDetected = ensureValidOutput(messages, state, elapsed);
        if (!outputDetected) return null;

        return detectStableCompletion(messages, state, elapsed);
    } catch (error) {
        log(`${PARALLEL_LOG.DELEGATE_TASK} Poll error (continuing):`, error);
        return null;
    }
}

function ensureValidOutput(
    messages: SessionMessage[],
    state: PollState,
    elapsed: number,
): boolean {
    if (state.hasValidOutput) return true;

    state.hasValidOutput = hasValidAssistantOutput(messages);
    if (state.hasValidOutput) {
        log(`${PARALLEL_LOG.DELEGATE_TASK} Valid output detected`, { pollCount: state.pollCount, elapsed });
    }

    return state.hasValidOutput;
}

function detectStableCompletion(
    messages: SessionMessage[],
    state: PollState,
    elapsed: number,
): PollResult | null {
    const count = messages.length;

    if (count !== state.lastMsgCount) {
        state.stablePolls = 0;
        state.lastMsgCount = count;
        return null;
    }

    state.stablePolls++;
    if (state.stablePolls < STABLE_POLLS_REQUIRED) return null;

    log(`${PARALLEL_LOG.DELEGATE_TASK} Stable completion`, {
        pollCount: state.pollCount,
        stablePolls: state.stablePolls,
        elapsed,
    });
    return { success: true, timedOut: false, pollCount: state.pollCount, elapsedMs: elapsed };
}

function delay(ms: number, abort?: AbortSignal): Promise<boolean> {
    if (abort?.aborted) return Promise.resolve(true);

    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            cleanup();
            resolve(false);
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            cleanup();
            resolve(true);
        };
        const cleanup = () => abort?.removeEventListener("abort", onAbort);

        abort?.addEventListener("abort", onAbort, { once: true });
    });
}

/**
 * Extract final result from session messages
 */
async function extractSessionResult(
    session: Pick<SessionClient, 'messages'>,
    sessionID: string
): Promise<string> {
    try {
        const messages = await readSessionMessages(session, sessionID);
        const lastMsg = messages.filter(m => m.info?.role === MESSAGE_ROLES.ASSISTANT).reverse()[0];
        const text = lastMsg?.parts
            ?.filter(p => p.type === PART_TYPES.TEXT || p.type === PART_TYPES.REASONING)
            .map(p => p.text ?? "")
            .join("\n") || "";
        return text;
    } catch (error) {
        log(`${PARALLEL_LOG.DELEGATE_TASK} Error extracting result:`, error);
        return "(Error extracting result)";
    }
}

function readDelegateTaskArgs(args: Record<string, unknown>): DelegateTaskArgs {
    return {
        agent: readRequiredString(args, PARALLEL_PARAMS.AGENT),
        description: readRequiredString(args, PARALLEL_PARAMS.DESCRIPTION),
        prompt: readRequiredString(args, PARALLEL_PARAMS.PROMPT),
        background: readOptionalBoolean(args, PARALLEL_PARAMS.BACKGROUND),
        resume: readOptionalString(args, PARALLEL_PARAMS.RESUME),
        mode: readOptionalMode(args, PARALLEL_PARAMS.MODE),
        groupID: readOptionalString(args, PARALLEL_PARAMS.GROUP_ID),
    };
}

function readRequiredString(args: Record<string, unknown>, key: string): string {
    const value = args[key];
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`'${key}' must be a non-empty string`);
    }
    return value;
}

function readOptionalString(args: Record<string, unknown>, key: string): string | undefined {
    const value = args[key];
    if (value === undefined) return undefined;
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`'${key}' must be a non-empty string when provided`);
    }
    return value;
}

function readOptionalBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
    const value = args[key];
    if (value === undefined) return undefined;
    if (typeof value !== "boolean") {
        throw new Error(`'${key}' must be a boolean when provided`);
    }
    return value;
}

function readOptionalMode(args: Record<string, unknown>, key: string): DelegateMode | undefined {
    const value = args[key];
    if (value === undefined) return undefined;
    if (value === "normal" || value === "race" || value === "fractal") {
        return value;
    }
    throw new Error(`'${key}' must be one of: normal, race, fractal`);
}

function findParentDepth(manager: ParallelAgentManager, parentSessionID: string): number {
    const parentTask = manager.getTaskBySession(parentSessionID);
    return parentTask?.depth ?? 0;
}

function logDelegateTaskExecution(args: DelegateTaskArgs, ctx: DelegateTaskContext, parentDepth: number): void {
    log(`${PARALLEL_LOG.DELEGATE_TASK} execute() called`, {
        agent: args.agent,
        description: args.description,
        background: args.background,
        resume: args.resume,
        mode: args.mode,
        groupID: args.groupID,
        parentSession: ctx.sessionID,
        depth: parentDepth,
    });
}

function buildTerminalNodeGuardMessage(parentDepth: number): string {
    return `${OUTPUT_LABEL.ERROR} Delegation blocked: You are a terminal node (depth ${parentDepth}).

**${AGENT_NAMES.WORKER} and ${AGENT_NAMES.REVIEWER} cannot spawn sub-agents.** This prevents infinite recursion.

If your task is too complex, please:
1. Report back to ${AGENT_NAMES.COMMANDER} with specific blockers
2. Request task decomposition at the ${AGENT_NAMES.PLANNER} level
3. Complete your assigned file directly without delegation`;
}

async function resumeDelegateTask(runtime: DelegateTaskRuntime): Promise<string> {
    const { manager, session, ctx, args, abort } = runtime;

    try {
        const task = await manager.resume({
            sessionId: args.resume as string,
            prompt: args.prompt,
            parentSessionID: ctx.sessionID,
        });

        if (!task) {
            return `Failed to resume task: ${args.description}`;
        }

        if (args.background === true) {
            return formatBackgroundResume(task);
        }

        return waitForResumedTask(session, task, abort);
    } catch (error) {
        return `${OUTPUT_LABEL.ERROR} Resume failed: ${formatError(error)}`;
    }
}

async function launchBackgroundDelegateTask(runtime: DelegateTaskRuntime): Promise<string> {
    const { manager, ctx, args, parentDepth } = runtime;

    try {
        const task = await launchDelegateTask(manager, args, ctx.sessionID, parentDepth);
        if (!task) {
            return `${OUTPUT_LABEL.ERROR} Failed to launch task: ${args.description}`;
        }

        presets.taskStarted(task.id, args.agent);
        return `${OUTPUT_LABEL.SPAWNED} task: \`${task.id}\` (${args.agent})\n` +
            `Session: \`${task.sessionID}\` (save for resume)`;
    } catch (error) {
        return `${OUTPUT_LABEL.ERROR} Failed: ${formatError(error)}`;
    }
}

async function launchSyncDelegateTask(runtime: DelegateTaskRuntime): Promise<string> {
    const { manager, session, ctx, args, parentDepth, abort } = runtime;

    try {
        const task = await launchDelegateTask(manager, args, ctx.sessionID, parentDepth);
        if (!task) {
            return `${OUTPUT_LABEL.ERROR} Failed to launch task: ${args.description}`;
        }

        return waitForLaunchedTask(session, task, args.agent, abort);
    } catch (error) {
        log(`${PARALLEL_LOG.DELEGATE_TASK} Sync: error`, error);
        return `${OUTPUT_LABEL.ERROR} Failed: ${formatError(error)}`;
    }
}

async function launchDelegateTask(
    manager: ParallelAgentManager,
    args: DelegateTaskArgs,
    parentSessionID: string,
    parentDepth: number,
): Promise<ParallelTask | null> {
    const launchResult = await manager.launch({
        agent: args.agent,
        description: args.description,
        prompt: args.prompt,
        parentSessionID,
        mode: args.mode,
        groupID: args.groupID,
        depth: parentDepth,
    });

    return Array.isArray(launchResult) ? launchResult[0] ?? null : launchResult ?? null;
}

async function waitForResumedTask(
    session: SessionClient,
    task: ParallelTask,
    abort?: AbortSignal,
): Promise<string> {
    const startTime = Date.now();

    log(`${PARALLEL_LOG.DELEGATE_TASK} Resume: starting sync wait`, {
        taskId: task.id,
        sessionID: task.sessionID,
    });

    const pollResult = await pollWithSafetyLimits(session, task.sessionID, startTime, abort);
    if (pollResult.aborted) {
        return formatAbortedWait(task, pollResult);
    }
    if (pollResult.timedOut) {
        return `${OUTPUT_LABEL.TIMEOUT} after ${Math.floor(pollResult.elapsedMs / 1000)}s (${pollResult.pollCount} polls)\n` +
            `Session: \`${task.sessionID}\` - Use get_task_result or resume later.`;
    }

    const text = await extractSessionResult(session, task.sessionID);
    return `${OUTPUT_LABEL.RESUMED_DONE} (${Math.floor(pollResult.elapsedMs / 1000)}s)\n\n${text || "(No output)"}`;
}

async function waitForLaunchedTask(
    session: SessionClient,
    task: ParallelTask,
    agent: string,
    abort?: AbortSignal,
): Promise<string> {
    const startTime = Date.now();

    log(`${PARALLEL_LOG.DELEGATE_TASK} Sync: waiting`, {
        agent,
        taskId: task.id,
        sessionID: task.sessionID,
    });

    const pollResult = await pollWithSafetyLimits(session, task.sessionID, startTime, abort);
    if (pollResult.aborted) {
        return formatAbortedWait(task, pollResult);
    }
    if (pollResult.timedOut) {
        log(`${PARALLEL_LOG.DELEGATE_TASK} Sync: timed out`, pollResult);
        return `${OUTPUT_LABEL.TIMEOUT} after ${Math.floor(pollResult.elapsedMs / 1000)}s (${pollResult.pollCount} polls)\n` +
            `Task: \`${task.id}\`\n` +
            `Session: \`${task.sessionID}\` - Use ${TOOL_NAMES.GET_TASK_RESULT} or resume later.`;
    }

    const text = await extractSessionResult(session, task.sessionID);
    log(`${PARALLEL_LOG.DELEGATE_TASK} Sync: completed`, {
        taskId: task.id,
        sessionID: task.sessionID,
        elapsedMs: pollResult.elapsedMs,
    });

    return `${OUTPUT_LABEL.DONE} (${Math.floor(pollResult.elapsedMs / 1000)}s)\n` +
        `Task: \`${task.id}\`\n` +
        `Session: \`${task.sessionID}\` (save for resume)\n\n${text || "(No output)"}`;
}

function formatAbortedWait(task: ParallelTask, pollResult: PollResult): string {
    return `${OUTPUT_LABEL.ERROR} Polling aborted after ${Math.floor(pollResult.elapsedMs / 1000)}s (${pollResult.pollCount} polls)\n` +
        `Task: \`${task.id}\`\n` +
        `Session: \`${task.sessionID}\` - Use ${TOOL_NAMES.GET_TASK_RESULT} or resume later.`;
}

function formatBackgroundResume(task: ParallelTask): string {
    return `${OUTPUT_LABEL.RESUME} task: \`${task.id}\` (${task.agent}) in session \`${task.sessionID}\`\n\n` +
        `Previous context preserved. Use \`${TOOL_NAMES.GET_TASK_RESULT}({ taskId: "${task.id}" })\` when complete.`;
}

function formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export const createDelegateTaskTool = (manager: ParallelAgentManager, client: unknown): ToolDefinition => tool({
    description: DELEGATE_TASK_DESCRIPTION,
    args: DELEGATE_TASK_ARGS,
    async execute(args, context) {
        let taskArgs: DelegateTaskArgs;
        try {
            taskArgs = readDelegateTaskArgs(args as Record<string, unknown>);
        } catch (error) {
            return `${OUTPUT_LABEL.ERROR} Invalid arguments: ${formatError(error)}`;
        }

        const ctx = context as DelegateTaskContext;
        const parentDepth = findParentDepth(manager, ctx.sessionID);

        logDelegateTaskExecution(taskArgs, ctx, parentDepth);

        if (parentDepth >= PARALLEL_TASK.TERMINAL_DEPTH) {
            log(`${PARALLEL_LOG.DELEGATE_TASK} Terminal node guard triggered`, { parentDepth, TERMINAL_DEPTH: PARALLEL_TASK.TERMINAL_DEPTH });
            return buildTerminalNodeGuardMessage(parentDepth);
        }

        const sessionClient = client as { session: SessionClient };

        if (taskArgs.background === undefined) {
            return `${OUTPUT_LABEL.ERROR} 'background' parameter is REQUIRED.`;
        }

        const runtime = {
            manager,
            session: sessionClient.session,
            ctx,
            args: taskArgs,
            parentDepth,
            abort: ctx.abort,
        };

        if (taskArgs.resume) {
            return resumeDelegateTask(runtime);
        }

        if (taskArgs.background === true) {
            return launchBackgroundDelegateTask(runtime);
        }

        return launchSyncDelegateTask(runtime);
    },
});
