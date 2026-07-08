/**
 * Todo Continuation Handler
 * 
 * Monitors session.idle events and automatically continues execution
 * if there are incomplete todos remaining.
 * 
 * Features:
 * - Countdown toast before resuming (gives user chance to cancel)
 * - Skips if background tasks are running
 * - Respects abort/cancel from user
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { PART_TYPES, LOOP, TOAST_DURATION, TIME, STATUS_LABEL } from "../../shared/index.js";
import { log } from "../agents/logger.js";
import { presets } from "../notification/toast.js";
import { getIncompleteCount, hasRemainingWork, getNextPending } from "./stats.js";
import { generateContinuationPrompt, formatProgress } from "./formatters.js";
import type { Todo } from "../../shared/loop/types.js";
import { ParallelAgentManager } from "../agents/manager.js";
import { isSessionRecovering } from "../recovery/session-recovery.js";
import { verifyMissionCompletion, buildTodoIncompletePrompt } from "./verification.js";
import { createPruneTimer } from "./prune-timer.js";

type OpencodeClient = PluginInput["client"];

// State per session
interface ContinuationState {
    countdownTimer?: ReturnType<typeof setTimeout>;
    countdownStartedAt?: number;
    isAborting?: boolean;
    lastIdleTime?: number;
    abortDetectedAt?: number;  // Track when abort was detected
    lastAccessedAt: number;
}

interface SessionIdleRequest {
    client: OpencodeClient;
    directory: string;
    sessionID: string;
    mainSessionID?: string;
}

interface ContinuationCountdownInput {
    todos: Todo[];
    hasBuiltinWork: boolean;
    scheduledAt: number;
}

const CONTINUATION_TTL_MS = 10 * 60 * 1000;
const PRUNE_INTERVAL_MS = 2 * 60 * 1000;

const sessionStates = new Map<string, ContinuationState>();

// Configuration (from shared constants)
const COUNTDOWN_SECONDS = 2;  // Slightly shorter than mission-conclude for responsiveness
const TOAST_DURATION_MS = TOAST_DURATION.EXTRA_SHORT;
const MIN_TIME_BETWEEN_CONTINUATIONS_MS = LOOP.MIN_TIME_BETWEEN_CHECKS_MS;
const COUNTDOWN_GRACE_PERIOD_MS = LOOP.COUNTDOWN_GRACE_PERIOD_MS;
const ABORT_WINDOW_MS = LOOP.ABORT_WINDOW_MS;

const pruneTimer = createPruneTimer({
    intervalMs: PRUNE_INTERVAL_MS,
    prune: () => {
        const now = Date.now();
        for (const [sessionID, state] of sessionStates.entries()) {
            if (now - state.lastAccessedAt > CONTINUATION_TTL_MS) {
                if (state.countdownTimer) {
                    clearTimeout(state.countdownTimer);
                }
                sessionStates.delete(sessionID);
                log(`[todo-continuation] Pruned stale state`, { sessionID });
            }
        }
    }
});

/**
 * Get or create continuation state for a session
 */
function getState(sessionID: string): ContinuationState {
    let state = sessionStates.get(sessionID);
    if (!state) {
        state = { lastAccessedAt: Date.now() };
        sessionStates.set(sessionID, state);
    } else {
        state.lastAccessedAt = Date.now();
    }
    return state;
}

/**
 * Cancel any pending countdown
 */
function cancelCountdown(sessionID: string): void {
    const state = sessionStates.get(sessionID);
    if (state?.countdownTimer) {
        clearTimeout(state.countdownTimer);
        state.countdownTimer = undefined;
        state.countdownStartedAt = undefined;
    }
}

/**
 * Parse todos from OpenCode session.todo API response
 */
function parseTodos(data: unknown): Todo[] {
    if (!Array.isArray(data)) return [];
    return data.filter((item): item is Todo =>
        item && typeof item === "object" && "id" in item && "status" in item
    ).map(item => ({
        id: item.id,
        content: item.content || "",
        status: item.status || STATUS_LABEL.PENDING,
        priority: item.priority || STATUS_LABEL.MEDIUM,
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
    }));
}

/**
 * Check if session has running background tasks
 */
function hasRunningBackgroundTasks(parentSessionID: string): boolean {
    try {
        const manager = ParallelAgentManager.getInstance();
        const tasks = manager.getTasksByParent(parentSessionID);
        return tasks.some(t => t.status === STATUS_LABEL.RUNNING);
    } catch (err) {
        log("[todo-continuation] Failed to check background tasks", { sessionID: parentSessionID, error: err });
        return false;
    }
}

/**
 * Show countdown toast
 */
async function showCountdownToast(
    client: OpencodeClient,
    secondsRemaining: number,
    incompleteCount: number
): Promise<void> {
    try {
        if (client.tui?.showToast) {
            await client.tui.showToast({
                body: {
                    title: "📋 Todo Continuation",
                    message: `Resuming in ${secondsRemaining}s... (${incompleteCount} tasks remaining)`,
                    variant: "warning",
                    duration: TOAST_DURATION_MS,
                },
            });
        }
    } catch (error) {
        log(`[todo-continuation] Toast failed:`, error);
    }
}

/**
 * Inject continuation prompt to session
 */
async function injectContinuation(
    client: OpencodeClient,
    directory: string,
    sessionID: string,
    todos: Todo[]
): Promise<void> {
    const state = getState(sessionID);
    if (shouldSkipInjection(state, sessionID)) return;

    const prompt = buildContinuationPrompt(directory, todos);
    if (!prompt) {
        log("[todo-continuation] Skipped: no continuation prompt needed", { sessionID });
        return;
    }

    sendContinuationPrompt(client, sessionID, prompt, todos);
}

function shouldSkipInjection(state: ContinuationState, sessionID: string): boolean {
    if (state.isAborting) {
        log("[todo-continuation] Skipped: user is aborting", { sessionID });
        return true;
    }
    if (hasRunningBackgroundTasks(sessionID)) {
        log("[todo-continuation] Skipped: background tasks running", { sessionID });
        return true;
    }
    if (isSessionRecovering(sessionID)) {
        log("[todo-continuation] Skipped: session is recovering from error", { sessionID });
        return true;
    }

    return false;
}

function buildContinuationPrompt(directory: string, todos: Todo[]): string {
    const prompt = generateContinuationPrompt(todos);
    if (prompt) return prompt;

    try {
        const verification = verifyMissionCompletion(directory);
        return hasFileBasedWork(verification) ? buildTodoIncompletePrompt(verification) : "";
    } catch (err) {
        log("[todo-continuation] Failed to generate file-based prompt", err);
        return "";
    }
}

function sendContinuationPrompt(
    client: OpencodeClient,
    sessionID: string,
    prompt: string,
    todos: Todo[]
): void {
    try {
        // Fire and forget: Do NOT await prompt injection.
        // Prevents blocking the plugin's main event loop during idle-triggered resumptions.
        client.session.prompt({
            path: { id: sessionID },
            body: {
                parts: [{ type: PART_TYPES.TEXT, text: prompt }],
            },
        }).catch(error => {
            log("[todo-continuation] Failed to inject continuation", { sessionID, error });
        });

        log("[todo-continuation] Injected continuation prompt (async)", {
            sessionID,
            incompleteCount: getIncompleteCount(todos),
            progress: formatProgress(todos),
        });
    } catch (error) {
        log("[todo-continuation] Failed to trigger async continuation", { sessionID, error });
    }
}

/**
 * Handle session.idle event - start countdown if todos remain
 */
export async function handleSessionIdle(
    client: OpencodeClient,
    directory: string,
    sessionID: string,
    mainSessionID?: string
): Promise<void> {
    const request = { client, directory, sessionID, mainSessionID };
    const state = getState(sessionID);
    const now = Date.now();

    if (shouldSkipIdleRequest(request, state, now)) {
        return;
    }

    const todos = await fetchTodosForIdle(client, sessionID);
    if (!todos) {
        return;
    }

    const hasBuiltinWork = hasRemainingWork(todos);
    const hasFileWork = checkFileWorkForIdle(directory);

    if (!hasBuiltinWork && !hasFileWork) {
        log("[todo-continuation] All work complete (built-in and file-based)", { sessionID });
        return;
    }

    await startContinuationCountdown(request, state, {
        todos,
        hasBuiltinWork,
        scheduledAt: now,
    });
}

function shouldSkipIdleRequest(
    request: SessionIdleRequest,
    state: ContinuationState,
    now: number
): boolean {
    if (isIdleRateLimited(state, request.sessionID, now)) return true;
    state.lastIdleTime = now;
    cancelCountdown(request.sessionID);

    return shouldSkipNonMainSession(request)
        || shouldSkipRecoveringSession(request.sessionID)
        || shouldSkipRecentAbort(state, request.sessionID)
        || shouldSkipRunningBackgroundTasks(request.sessionID);
}

function isIdleRateLimited(state: ContinuationState, sessionID: string, now: number): boolean {
    if (!state.lastIdleTime || (now - state.lastIdleTime) >= MIN_TIME_BETWEEN_CONTINUATIONS_MS) {
        return false;
    }

    log("[todo-continuation] Skipped: too soon since last check", { sessionID });
    return true;
}

function shouldSkipNonMainSession(request: SessionIdleRequest): boolean {
    const { sessionID, mainSessionID } = request;
    if (!mainSessionID || sessionID === mainSessionID) return false;

    log("[todo-continuation] Skipped: not main session", { sessionID, mainSessionID });
    return true;
}

function shouldSkipRecoveringSession(sessionID: string): boolean {
    if (!isSessionRecovering(sessionID)) return false;

    log("[todo-continuation] Skipped: in recovery mode", { sessionID });
    return true;
}

function shouldSkipRecentAbort(state: ContinuationState, sessionID: string): boolean {
    if (!state.abortDetectedAt) return false;

    const timeSinceAbort = Date.now() - state.abortDetectedAt;
    state.abortDetectedAt = undefined;
    if (timeSinceAbort >= ABORT_WINDOW_MS) return false;

    log("[todo-continuation] Skipped: abort detected recently", { sessionID, timeSinceAbort });
    return true;
}

function shouldSkipRunningBackgroundTasks(sessionID: string): boolean {
    if (!hasRunningBackgroundTasks(sessionID)) return false;

    log("[todo-continuation] Skipped: background tasks running", { sessionID });
    return true;
}

async function fetchTodosForIdle(
    client: OpencodeClient,
    sessionID: string
): Promise<Todo[] | undefined> {
    try {
        const response = await client.session.todo({ path: { id: sessionID } });
        return parseTodos(response.data);
    } catch (error) {
        log("[todo-continuation] Failed to fetch todos", { sessionID, error });
        return undefined;
    }
}

function checkFileWorkForIdle(directory: string): boolean {
    try {
        return hasFileBasedWork(verifyMissionCompletion(directory));
    } catch (err) {
        log("[todo-continuation] Failed to check file-based todos", err);
        return false;
    }
}

function hasFileBasedWork(verification: ReturnType<typeof verifyMissionCompletion>): boolean {
    return !verification.passed
        && (verification.todoIncomplete > 0 ||
            (verification.checklistProgress !== "0/0" && !verification.checklistComplete));
}

async function startContinuationCountdown(
    request: SessionIdleRequest,
    state: ContinuationState,
    input: ContinuationCountdownInput
): Promise<void> {
    const { todos, hasBuiltinWork, scheduledAt } = input;
    const incompleteCount = hasBuiltinWork ? getIncompleteCount(todos) : 0;
    const nextPending = getNextPending(todos);
    log("[todo-continuation] Starting countdown", {
        sessionID: request.sessionID,
        incompleteCount,
        nextPending: nextPending?.id,
    });

    await showCountdownToast(request.client, COUNTDOWN_SECONDS, incompleteCount);
    state.countdownStartedAt = scheduledAt;
    state.countdownTimer = setTimeout(
        () => runContinuationCountdown(request),
        COUNTDOWN_SECONDS * TIME.SECOND
    );
}

async function runContinuationCountdown(request: SessionIdleRequest): Promise<void> {
    const { client, directory, sessionID } = request;
    cancelCountdown(sessionID);

    try {
        const freshResponse = await client.session.todo({ path: { id: sessionID } });
        const freshTodos = parseTodos(freshResponse.data);
        const freshFileWork = checkFileWorkForCountdown(directory, sessionID);

        if (hasRemainingWork(freshTodos) || freshFileWork) {
            await injectContinuation(client, directory, sessionID, freshTodos);
        } else {
            log("[todo-continuation] All work completed during countdown", { sessionID });
        }
    } catch {
        log("[todo-continuation] Failed to re-fetch todos for continuation", { sessionID });
    }
}

function checkFileWorkForCountdown(directory: string, sessionID: string): boolean {
    try {
        return hasFileBasedWork(verifyMissionCompletion(directory));
    } catch (err) {
        log("[todo-continuation] Failed to verify file work", { sessionID, error: err });
        return false;
    }
}

/**
 * Handle user message - cancel countdown (user is interacting)
 * Uses grace period to avoid cancelling countdown from our own injected messages
 */
export function handleUserMessage(sessionID: string): void {
    const state = getState(sessionID);

    // Grace period: ignore messages right after countdown starts
    // (our own continuation prompt injection)
    if (state.countdownStartedAt) {
        const elapsed = Date.now() - state.countdownStartedAt;
        if (elapsed < COUNTDOWN_GRACE_PERIOD_MS) {
            log("[todo-continuation] Ignoring message in grace period", { sessionID, elapsed });
            return;
        }
    }

    // Cancel countdown if user sends a message
    if (state.countdownTimer) {
        log("[todo-continuation] Cancelled: user interaction", { sessionID });
        cancelCountdown(sessionID);
    }

    // Reset flags
    state.isAborting = false;
    state.abortDetectedAt = undefined;
}

/**
 * Handle session error - detect abort/cancel
 */
export function handleSessionError(sessionID: string, error: unknown): void {
    const state = getState(sessionID);
    const errorObj = error as { name?: string } | undefined;

    if (errorObj?.name === "MessageAbortedError" || errorObj?.name === "AbortError") {
        state.abortDetectedAt = Date.now();
        log("[todo-continuation] Abort detected", { sessionID, errorName: errorObj.name });
    }

    cancelCountdown(sessionID);
}

/**
 * Handle abort/cancel - prevent automatic continuation
 */
export function handleAbort(sessionID: string): void {
    const state = getState(sessionID);
    state.isAborting = true;
    state.abortDetectedAt = Date.now();
    cancelCountdown(sessionID);
    log("[todo-continuation] Marked as aborting", { sessionID });
}

/**
 * Clean up session state
 */
export function cleanupSession(sessionID: string): void {
    cancelCountdown(sessionID);
    sessionStates.delete(sessionID);
}

/**
 * Check if there's a pending continuation countdown
 */
export function hasPendingContinuation(sessionID: string): boolean {
    return !!sessionStates.get(sessionID)?.countdownTimer;
}

pruneTimer.start();
