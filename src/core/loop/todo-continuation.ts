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
import { presets } from "../../shared/index.js";
import { getIncompleteCount, hasRemainingWork, getNextPending } from "./stats.js";
import { generateContinuationPrompt, formatProgress } from "./formatters.js";
import type { Todo } from "./interfaces.js";
import { ParallelAgentManager } from "../agents/manager.js";
import { isSessionRecovering } from "../recovery/session-recovery.js";
import { verifyMissionCompletion, buildTodoIncompletePrompt } from "./verification.js";

type OpencodeClient = PluginInput["client"];

// State per session
interface ContinuationState {
    countdownTimer?: ReturnType<typeof setTimeout>;
    countdownStartedAt?: number;
    isAborting?: boolean;
    lastIdleTime?: number;
    abortDetectedAt?: number;  // Track when abort was detected
}

const sessionStates = new Map<string, ContinuationState>();

// Configuration (from shared constants)
const COUNTDOWN_SECONDS = 2;  // Slightly shorter than mission-conclude for responsiveness
const TOAST_DURATION_MS = TOAST_DURATION.EXTRA_SHORT;
const MIN_TIME_BETWEEN_CONTINUATIONS_MS = LOOP.MIN_TIME_BETWEEN_CHECKS_MS;
const COUNTDOWN_GRACE_PERIOD_MS = LOOP.COUNTDOWN_GRACE_PERIOD_MS;
const ABORT_WINDOW_MS = LOOP.ABORT_WINDOW_MS;

/**
 * Get or create continuation state for a session
 */
function getState(sessionID: string): ContinuationState {
    let state = sessionStates.get(sessionID);
    if (!state) {
        state = {};
        sessionStates.set(sessionID, state);
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
    } catch {
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
        const tuiClient = client as unknown as { tui?: { showToast?: (opts: unknown) => Promise<void> } };
        if (tuiClient.tui?.showToast) {
            await tuiClient.tui.showToast({
                body: {
                    title: "📋 Todo Continuation",
                    message: `Resuming in ${secondsRemaining}s... (${incompleteCount} tasks remaining)`,
                    variant: "warning",
                    duration: TOAST_DURATION_MS,
                },
            });
        }
    } catch {
        // Toast failed, continue anyway
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

    // Double-check conditions before injecting
    if (state.isAborting) {
        log("[todo-continuation] Skipped: user is aborting", { sessionID });
        return;
    }

    if (hasRunningBackgroundTasks(sessionID)) {
        log("[todo-continuation] Skipped: background tasks running", { sessionID });
        return;
    }

    if (isSessionRecovering(sessionID)) {
        log("[todo-continuation] Skipped: session is recovering from error", { sessionID });
        return;
    }

    // Generate continuation prompt
    let prompt = generateContinuationPrompt(todos);

    // [Improvement]: If no built-in prompt, check for file-based TODOs
    if (!prompt) {
        try {
            // Use specialized hook-style prompt for file-based todos
            const v = verifyMissionCompletion(directory);
            if (!v.passed && (v.todoIncomplete > 0 || (v.checklistProgress !== "0/0" && !v.checklistComplete))) {
                prompt = buildTodoIncompletePrompt(v);
            }
        } catch (err) {
            log("[todo-continuation] Failed to generate file-based prompt", err);
        }
    }

    if (!prompt) {
        log("[todo-continuation] Skipped: no continuation prompt needed", { sessionID });
        return;
    }

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
    const state = getState(sessionID);
    const now = Date.now();

    // Rate limit: don't continue too frequently
    if (state.lastIdleTime && (now - state.lastIdleTime) < MIN_TIME_BETWEEN_CONTINUATIONS_MS) {
        log("[todo-continuation] Skipped: too soon since last check", { sessionID });
        return;
    }
    state.lastIdleTime = now;

    // Cancel any existing countdown
    cancelCountdown(sessionID);

    // Skip if not the main session (or if we're a background task session)
    if (mainSessionID && sessionID !== mainSessionID) {
        log("[todo-continuation] Skipped: not main session", { sessionID, mainSessionID });
        return;
    }

    // Skip if recovering from error
    if (isSessionRecovering(sessionID)) {
        log("[todo-continuation] Skipped: in recovery mode", { sessionID });
        return;
    }

    // Skip if abort was detected recently
    if (state.abortDetectedAt) {
        const timeSinceAbort = Date.now() - state.abortDetectedAt;
        if (timeSinceAbort < ABORT_WINDOW_MS) {
            log("[todo-continuation] Skipped: abort detected recently", { sessionID, timeSinceAbort });
            state.abortDetectedAt = undefined;  // Clear after checking
            return;
        }
        state.abortDetectedAt = undefined;  // Clear stale abort
    }

    // Skip if background tasks are running
    if (hasRunningBackgroundTasks(sessionID)) {
        log("[todo-continuation] Skipped: background tasks running", { sessionID });
        return;
    }

    // Fetch todos
    let todos: Todo[] = [];
    try {
        const response = await client.session.todo({ path: { id: sessionID } });
        todos = parseTodos(response.data ?? response);
    } catch (error) {
        log("[todo-continuation] Failed to fetch todos", { sessionID, error });
        return;
    }

    // Check if there are incomplete todos
    const hasBuiltinWork = hasRemainingWork(todos);

    // [Improvement]: Also check for file-based TODOs
    let hasFileWork = false;
    try {
        const verification = verifyMissionCompletion(directory);
        hasFileWork = !verification.passed && (verification.todoIncomplete > 0 || (verification.checklistProgress !== "0/0" && !verification.checklistComplete));
    } catch (err) {
        log("[todo-continuation] Failed to check file-based todos", err);
    }

    if (!hasBuiltinWork && !hasFileWork) {
        log("[todo-continuation] All work complete (built-in and file-based)", { sessionID });
        return;
    }

    const incompleteCount = hasBuiltinWork ? getIncompleteCount(todos) : 0;
    const fileIncompleteCount = hasFileWork ? 1 : 0; // Simplified
    const nextPending = getNextPending(todos);
    log("[todo-continuation] Starting countdown", {
        sessionID,
        incompleteCount,
        nextPending: nextPending?.id,
    });

    // Show initial countdown toast
    await showCountdownToast(client, COUNTDOWN_SECONDS, incompleteCount);
    state.countdownStartedAt = now;

    // Start countdown timer
    state.countdownTimer = setTimeout(async () => {
        cancelCountdown(sessionID);

        // Re-fetch todos to ensure they're still incomplete
        try {
            const freshResponse = await client.session.todo({ path: { id: sessionID } });
            const freshTodos = parseTodos(freshResponse.data ?? freshResponse);

            // Re-verify file work
            let freshFileWork = false;
            try {
                const v = verifyMissionCompletion(directory);
                freshFileWork = !v.passed && (v.todoIncomplete > 0 || (v.checklistProgress !== "0/0" && !v.checklistComplete));
            } catch { }

            if (hasRemainingWork(freshTodos) || freshFileWork) {
                await injectContinuation(client, directory, sessionID, freshTodos);
            } else {
                log("[todo-continuation] All work completed during countdown", { sessionID });
            }
        } catch {
            log("[todo-continuation] Failed to re-fetch todos for continuation", { sessionID });
        }
    }, COUNTDOWN_SECONDS * TIME.SECOND);
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
