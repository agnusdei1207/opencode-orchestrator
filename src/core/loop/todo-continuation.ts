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
import { LOOP, TIME, STATUS_LABEL } from "../../shared/index.js";
import { log } from "../agents/logger.js";
import { getIncompleteCount, hasRemainingWork, getNextPending } from "./stats.js";
import { generateContinuationPrompt, formatProgress } from "./formatters.js";
import type { Todo } from "../../shared/loop/types.js";
import { ParallelAgentManager } from "../agents/manager.js";
import { isSessionRecovering } from "../recovery/session-recovery.js";
import { verifyMissionCompletion, buildVerificationFailurePrompt } from "./verification.js";
import { createPruneTimer } from "./prune-timer.js";
import { showContinuationCountdownToast } from "./continuation-toast.js";
import { isSessionBusy, isKnownBusy } from "../session/activity.js";
import { syntheticTextPart } from "../session/injection.js";

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

type TodoRecord = Record<string, unknown> & { id: string; status: Todo["status"] };

const CONTINUATION_TTL_MS = 10 * 60 * 1000;
const PRUNE_INTERVAL_MS = 2 * 60 * 1000;

const sessionStates = new Map<string, ContinuationState>();

// Configuration (from shared constants)
const COUNTDOWN_SECONDS = 2;  // Slightly shorter than mission-conclude for responsiveness
const MIN_TIME_BETWEEN_CONTINUATIONS_MS = LOOP.MIN_TIME_BETWEEN_CHECKS_MS;
const COUNTDOWN_GRACE_PERIOD_MS = LOOP.COUNTDOWN_GRACE_PERIOD_MS;
const ABORT_WINDOW_MS = LOOP.ABORT_WINDOW_MS;
const TODO_STATUSES = new Set<Todo["status"]>([
    STATUS_LABEL.PENDING,
    STATUS_LABEL.IN_PROGRESS,
    STATUS_LABEL.COMPLETED,
    STATUS_LABEL.CANCELLED,
]);
const TODO_PRIORITIES = new Set<Todo["priority"]>([
    STATUS_LABEL.HIGH,
    STATUS_LABEL.MEDIUM,
    STATUS_LABEL.LOW,
]);

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
let pruneTimerStarted = false;

function ensurePruneTimerStarted(): void {
    if (pruneTimerStarted) return;

    pruneTimer.start();
    pruneTimerStarted = true;
}

function shutdownPruneTimerIfIdle(): void {
    if (sessionStates.size > 0) return;

    pruneTimer.shutdown();
    pruneTimerStarted = false;
}

/**
 * Get or create continuation state for a session
 */
function getState(sessionID: string): ContinuationState {
    ensurePruneTimerStarted();

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
    return data.filter(isTodoRecord).map(item => ({
        id: item.id,
        content: typeof item.content === "string" ? item.content : "",
        status: item.status,
        priority: readTodoPriority(item.priority),
        createdAt: readTodoDate(item.createdAt),
    }));
}

function isTodoRecord(item: unknown): item is TodoRecord {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    return typeof record.id === "string" && isTodoStatus(record.status);
}

function isTodoStatus(status: unknown): status is Todo["status"] {
    return typeof status === "string" && TODO_STATUSES.has(status as Todo["status"]);
}

function readTodoPriority(priority: unknown): Todo["priority"] {
    return typeof priority === "string" && TODO_PRIORITIES.has(priority as Todo["priority"])
        ? priority as Todo["priority"]
        : STATUS_LABEL.MEDIUM;
}

function readTodoDate(value: unknown): Date {
    if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
        return new Date();
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date() : date;
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
        return true;
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

    await sendContinuationPrompt(client, sessionID, prompt, todos);
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
        return hasFileBasedWork(verification) ? buildVerificationFailurePrompt(verification) : "";
    } catch (err) {
        log("[todo-continuation] Failed to generate file-based prompt", err);
        return "";
    }
}

async function sendContinuationPrompt(
    client: OpencodeClient,
    sessionID: string,
    prompt: string,
    todos: Todo[]
): Promise<void> {
    // Last-moment check against the authoritative session status. Prompting a
    // running session appends the message into the turn already in flight, which
    // the model experiences as being interrupted mid tool call.
    if (await isSessionBusy(client, sessionID)) {
        log("[todo-continuation] Skipped: session is busy", { sessionID });
        return;
    }

    try {
        await client.session.prompt({
            path: { id: sessionID },
            body: {
                parts: [syntheticTextPart(prompt)],
            },
        });

        log("[todo-continuation] Injected continuation prompt", {
            sessionID,
            incompleteCount: getIncompleteCount(todos),
            progress: formatProgress(todos),
        });
    } catch (error) {
        log("[todo-continuation] Failed to inject continuation", { sessionID, error });
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
    const shouldSkip = shouldSkipNonMainSession(request)
        || shouldSkipRecoveringSession(request.sessionID)
        || shouldSkipRecentAbort(state, request.sessionID)
        || shouldSkipBusySession(request.sessionID)
        || shouldSkipRunningBackgroundTasks(request.sessionID);

    if (shouldSkip) return true;
    if (isIdleRateLimited(state, request.sessionID, now)) return true;

    state.lastIdleTime = now;
    cancelCountdown(request.sessionID);
    return false;
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

/**
 * A `session.idle` event can be immediately followed by new work (a queued
 * prompt, a provider retry). Starting a countdown against a session that is
 * already busy again only sets up an interruption.
 */
function shouldSkipBusySession(sessionID: string): boolean {
    if (!isKnownBusy(sessionID)) return false;

    log("[todo-continuation] Skipped: session is busy", { sessionID });
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

/**
 * Decide whether a failed verification represents real file-backed work.
 *
 * verifyMissionCompletion() fails whenever no TODO file exists, so an unqualified
 * `!passed` makes every ordinary idle session invent a mission and inject a false
 * completion gate. This handler runs on every session.idle - unlike the mission
 * loop, which already gates on an active loop state - so it must confirm the
 * workspace is tracking a mission at all before continuing one.
 *
 * The signal is file presence, not item counts: a TODO that is empty, malformed,
 * or unreadable still reports "0/0", yet it means a mission is being tracked and
 * must not be silently dropped.
 */
function tracksMission(verification: ReturnType<typeof verifyMissionCompletion>): boolean {
    return verification.todoPresent
        || verification.checklistPresent
        || !verification.syncIssuesEmpty;
}

function hasFileBasedWork(verification: ReturnType<typeof verifyMissionCompletion>): boolean {
    return !verification.passed && tracksMission(verification);
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

    await showContinuationCountdownToast(request.client, COUNTDOWN_SECONDS, incompleteCount);
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
    } catch (error) {
        log("[todo-continuation] Failed to re-fetch todos for continuation", { sessionID, error });
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
    const state = sessionStates.get(sessionID);
    if (!state) return;

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
    const errorName = getErrorName(error);

    if (errorName === "MessageAbortedError" || errorName === "AbortError") {
        state.abortDetectedAt = Date.now();
        log("[todo-continuation] Abort detected", { sessionID, errorName });
    }

    cancelCountdown(sessionID);
}

function getErrorName(error: unknown): string | undefined {
    if (!error || typeof error !== "object" || !("name" in error)) return undefined;
    const name = (error as { name?: unknown }).name;
    return typeof name === "string" ? name : undefined;
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
 * The session started working again while a countdown was pending. Drop it: the
 * model is already busy, and injecting now would interrupt the running turn.
 */
export function handleSessionBusy(sessionID: string): void {
    if (!sessionStates.get(sessionID)?.countdownTimer) return;

    log("[todo-continuation] Cancelled: session became busy", { sessionID });
    cancelCountdown(sessionID);
}

/**
 * Clean up session state.
 *
 * Session activity is deliberately NOT cleared here: it is owned by the session
 * layer and released once, on `session.deleted`, so that clearing one loop's
 * state cannot blind the other to a session that is still working.
 */
export function cleanupSession(sessionID: string): void {
    cancelCountdown(sessionID);
    sessionStates.delete(sessionID);
    shutdownPruneTimerIfIdle();
}

/**
 * Check if there's a pending continuation countdown
 */
/**
 * Stop the prune timer and drop all state, for plugin shutdown.
 *
 * shutdownPruneTimerIfIdle() only fires when the last session happens to be
 * cleaned up, so a dispose with sessions still tracked would leave the interval
 * and every pending countdown running.
 */
export function shutdownTodoContinuation(): void {
    for (const sessionID of sessionStates.keys()) {
        cancelCountdown(sessionID);
    }
    sessionStates.clear();
    pruneTimer.shutdown();
    pruneTimerStarted = false;
}

export function hasPendingContinuation(sessionID: string): boolean {
    return !!sessionStates.get(sessionID)?.countdownTimer;
}
