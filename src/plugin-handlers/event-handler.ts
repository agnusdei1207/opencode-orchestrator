/**
 * Event Handler
 * 
 * Handles OpenCode session events:
 * - session.created, session.deleted, session.error, session.idle
 * - message.updated
 */

import { ParallelAgentManager } from "../core/agents/manager.js";
import * as Toast from "../core/notification/toast.js";
import * as ProgressTracker from "../core/progress/tracker.js";
import * as SessionRecovery from "../core/recovery/session-recovery.js";
import * as TodoContinuation from "../core/loop/todo-continuation.js";
import * as MissionLoopHandler from "../core/loop/mission-loop-handler.js";
import { isLoopActive } from "../core/loop/mission-loop.js";
import * as ContextMonitor from "../core/context/index.js";
import * as SessionActivity from "../core/session/activity.js";
import * as PendingInjection from "../core/session/pending-injection.js";
import { SESSION_EVENTS, MESSAGE_EVENTS, MESSAGE_ROLES, SESSION_STATUS } from "../shared/index.js";
import type { PluginHandlerContext, PluginSessionState } from "./context.js";
import { handleCompletedAssistantMessage } from "./assistant-done-handler.js";
import { log } from "../core/agents/logger.js";

export type EventHandlerContext = PluginHandlerContext;

type PluginEvent = {
    type: string;
    properties?: Record<string, unknown>;
};

type EventInput = {
    event: PluginEvent;
};

type MessageUpdatedInfo = {
    id?: string;
    sessionID?: string;
    role?: string;
    time?: { completed?: number };
    tokens?: {
        input?: number;
        output?: number;
        reasoning?: number;
    };
};

const SESSION_ID_PREVIEW_LENGTH = 12;
const ERROR_PREVIEW_LENGTH = 50;
const IDLE_CONTINUATION_DELAY_MS = 500;
const SECOND_MS = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTE_MS = SECONDS_PER_MINUTE * SECOND_MS;

/**
 * Create event handler for session events
 */
export function createEventHandler(ctx: EventHandlerContext) {
    return async (input: EventInput) => {
        const { event } = input;

        notifyParallelAgentManager(event);
        await handlePluginEvent(ctx, event);
    };
}

async function handlePluginEvent(ctx: EventHandlerContext, event: PluginEvent): Promise<void> {
    switch (event.type) {
        case SESSION_EVENTS.CREATED:
            handleSessionCreated(event);
            return;
        case SESSION_EVENTS.DELETED:
            handleSessionDeleted(ctx, event);
            return;
        case SESSION_EVENTS.ERROR:
            await handleSessionError(ctx, event);
            return;
        case MESSAGE_EVENTS.UPDATED:
            await handleMessageUpdated(ctx, event);
            return;
        case SESSION_EVENTS.IDLE:
            handleSessionIdle(ctx, event);
            return;
        case SESSION_EVENTS.STATUS:
            handleSessionStatus(ctx, event);
            return;
    }
}

function notifyParallelAgentManager(event: PluginEvent): void {
    try {
        const manager = ParallelAgentManager.getInstance();
        manager.handleEvent(event as { type: string; properties?: { sessionID?: string; info?: { id?: string } } });
    } catch (error) {
        log(`[event-handler] Parallel agent manager could not handle ${event.type}: ${error}`);
    }
}

function handleSessionCreated(event: PluginEvent): void {
    const sessionID = readSessionID(event.properties);
    Toast.presets.missionStarted(`Session ${sessionID.slice(0, SESSION_ID_PREVIEW_LENGTH)}...`);
}

function handleSessionDeleted(ctx: EventHandlerContext, event: PluginEvent): void {
    const { sessions, state } = ctx;
    const sessionID = readSessionID(event.properties);
    const session = sessions.get(sessionID);
    if (!session) return;

    const duration = formatSessionDuration(Date.now() - session.startTime);

    sessions.delete(sessionID);
    state.sessions.delete(sessionID);
    ProgressTracker.clearSession(sessionID);
    SessionRecovery.cleanupSessionRecovery(sessionID);
    TodoContinuation.cleanupSession(sessionID);
    MissionLoopHandler.cleanupSession(sessionID);
    ContextMonitor.cleanupSession(sessionID);
    SessionActivity.clearSessionActivity(sessionID);
    PendingInjection.clearPrompts(sessionID);

    Toast.presets.sessionCompleted(sessionID, duration);
}

function formatSessionDuration(totalTime: number): string {
    return totalTime < MINUTE_MS
        ? `${Math.round(totalTime / SECOND_MS)}s`
        : `${Math.round(totalTime / MINUTE_MS)}m`;
}

async function handleSessionError(ctx: EventHandlerContext, event: PluginEvent): Promise<void> {
    const sessionID = readSessionID(event.properties);
    const error = event.properties?.error;

    if (sessionID) {
        TodoContinuation.handleSessionError(sessionID, error);
        MissionLoopHandler.handleAbort(sessionID);
    }

    if (sessionID && error) {
        const recovered = await SessionRecovery.handleSessionError(
            ctx.client, sessionID, error, event.properties
        );
        if (recovered) return;
    }

    Toast.presets.taskFailed("session", String(error).slice(0, ERROR_PREVIEW_LENGTH));
}

async function handleMessageUpdated(ctx: EventHandlerContext, event: PluginEvent): Promise<void> {
    const messageInfo = readMessageUpdatedInfo(event.properties);
    const sessionID = messageInfo?.sessionID;
    if (!sessionID) return;

    checkContextUsage(sessionID, messageInfo);

    if (messageInfo.role === MESSAGE_ROLES.ASSISTANT) {
        await handleAssistantMessageUpdated(ctx, sessionID, messageInfo);
        return;
    }

    if (messageInfo.role === MESSAGE_ROLES.USER) {
        TodoContinuation.handleUserMessage(sessionID);
        MissionLoopHandler.handleUserMessage(sessionID);
    }
}

function readMessageUpdatedInfo(properties: Record<string, unknown> | undefined): MessageUpdatedInfo | undefined {
    const info = properties?.info;
    return isRecord(info) ? info as MessageUpdatedInfo : undefined;
}

function checkContextUsage(sessionID: string, messageInfo: MessageUpdatedInfo): void {
    const totalTokens = readTotalTokens(messageInfo);
    if (totalTokens > 0) {
        ContextMonitor.checkContextWindow(sessionID, totalTokens);
    }
}

function readTotalTokens(messageInfo: MessageUpdatedInfo): number {
    return (messageInfo.tokens?.input ?? 0) +
        (messageInfo.tokens?.output ?? 0) +
        (messageInfo.tokens?.reasoning ?? 0);
}

async function handleAssistantMessageUpdated(
    ctx: EventHandlerContext,
    sessionID: string,
    messageInfo: MessageUpdatedInfo,
): Promise<void> {
    SessionRecovery.markRecoveryComplete(sessionID);
    if (!messageInfo.id || !messageInfo.time?.completed) return;

    markAssistantCompleted(ctx.sessions, sessionID);
    await handleCompletedAssistantMessage(ctx, sessionID, messageInfo.id);
}

function handleSessionIdle(ctx: EventHandlerContext, event: PluginEvent): void {
    const sessionID = readSessionID(event.properties);
    if (sessionID) {
        SessionActivity.recordSessionStatus(sessionID, SESSION_STATUS.IDLE);
        scheduleIdleContinuation(ctx, sessionID);
    }
}

/**
 * `session.status` is the push-based busy/idle signal. Feeding it to the
 * activity tracker is what lets every injection site refuse to prompt a session
 * that is still working, and lets a pending countdown be dropped the moment the
 * session picks work back up.
 */
function handleSessionStatus(ctx: EventHandlerContext, event: PluginEvent): void {
    const sessionID = readSessionID(event.properties);
    if (!sessionID) return;

    const statusType = readSessionStatusType(event.properties);
    SessionActivity.recordSessionStatus(sessionID, statusType);

    if (statusType === SESSION_STATUS.IDLE) {
        scheduleIdleContinuation(ctx, sessionID);
        return;
    }

    TodoContinuation.handleSessionBusy(sessionID);
    MissionLoopHandler.handleSessionBusy(sessionID);
}

function readSessionStatusType(properties: Record<string, unknown> | undefined): string | undefined {
    const status = properties?.status;
    return isRecord(status) ? readString(status.type) : undefined;
}

function readSessionID(properties: Record<string, unknown> | undefined): string {
    const directSessionID = readString(properties?.sessionID);
    if (directSessionID) return directSessionID;

    const info = properties?.info;
    if (!isRecord(info)) return "";
    return readString(info.id) ?? "";
}

function readString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function markAssistantCompleted(sessions: Map<string, PluginSessionState>, sessionID: string): void {
    const session = sessions.get(sessionID);
    if (!session) return;

    session.lastAssistantCompletedAt = Date.now();
}

/**
 * True only for a deliberate stop: the user aborted, and no assistant turn has
 * completed since. Distinct from `shouldContinueAfterIdle`, which also declines
 * for benign reasons — no turn has run yet, or the user simply spoke last.
 */
function wasAbortedSinceLastTurn(session: PluginSessionState | undefined): boolean {
    if (!session?.lastAbortAt) return false;
    return !session.lastAssistantCompletedAt || session.lastAssistantCompletedAt < session.lastAbortAt;
}

function shouldContinueAfterIdle(session: PluginSessionState | undefined): boolean {
    if (!session?.active || !session.lastAssistantCompletedAt) {
        return false;
    }

    if (session.lastUserMessageAt && session.lastAssistantCompletedAt < session.lastUserMessageAt) {
        return false;
    }

    if (session.lastAbortAt && session.lastAssistantCompletedAt < session.lastAbortAt) {
        return false;
    }

    return true;
}

function markAbort(sessions: Map<string, PluginSessionState>, sessionID: string): void {
    const session = sessions.get(sessionID);
    if (session) {
        session.lastAbortAt = Date.now();
    }
    TodoContinuation.handleAbort(sessionID);
    MissionLoopHandler.handleAbort(sessionID);
}

function scheduleIdleContinuation(ctx: EventHandlerContext, sessionID: string): void {
    const { sessions } = ctx;

    // Untracked sessions are normally none of our business — except when we are
    // already holding something for one. A session can receive a queued notice
    // (its background task finished) without ever having been initialised here,
    // and skipping it would strand that notice until the TTL sweep discarded it.
    if (!sessions.has(sessionID) && !PendingInjection.hasPendingPrompts(sessionID)) return;

    scheduleDelayedHandler("idle continuation", sessionID, () => runIdleContinuation(ctx, sessionID));
}

async function runIdleContinuation(ctx: EventHandlerContext, sessionID: string): Promise<void> {
    const { client, directory, sessions } = ctx;
    const session = sessions.get(sessionID);

    // A deliberate stop means the user does not want any of this delivered.
    if (wasAbortedSinceLastTurn(session)) {
        markAbort(sessions, sessionID);
        PendingInjection.clearPrompts(sessionID);
        return;
    }

    // Deferred prompts go out at the first genuine idle — including an idle the
    // continuation logic itself declines to act on. `shouldContinueAfterIdle`
    // requires a completed assistant turn, which a session that only spawned a
    // background task has never had; gating the flush on it silently discarded
    // the completion notice for that task.
    //
    // A flush starts a new turn, so mission/todo continuation waits for the next
    // idle rather than piling on top of it.
    if (await PendingInjection.flushPrompts(client, sessionID)) {
        return;
    }

    if (!shouldContinueAfterIdle(session)) {
        markAbort(sessions, sessionID);
        return;
    }

    if (isLoopActive(directory, sessionID)) {
        await MissionLoopHandler.handleMissionIdle(client, directory, sessionID, sessionID);
        return;
    }

    await TodoContinuation.handleSessionIdle(client, directory, sessionID, sessionID);
}

function scheduleDelayedHandler(label: string, sessionID: string, handler: () => Promise<void>): void {
    setTimeout(() => {
        handler().catch(error => {
            log(`[event-handler] ${label} failed for ${sessionID}: ${error}`);
        });
    }, IDLE_CONTINUATION_DELAY_MS);
}
