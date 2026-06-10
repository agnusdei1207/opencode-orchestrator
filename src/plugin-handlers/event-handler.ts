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
import { SESSION_EVENTS, MESSAGE_EVENTS, MESSAGE_ROLES } from "../shared/index.js";
import type { EventHandlerContext, SessionState } from "./interfaces/index.js";
import { handleCompletedAssistantMessage } from "./assistant-done-handler.js";

// Re-export interfaces for backward compatibility
export type { SessionState, OrchestratorState, EventHandlerContext } from "./interfaces/index.js";

/**
 * Create event handler for session events
 */
export function createEventHandler(ctx: EventHandlerContext) {
    const { client, directory, sessions, state } = ctx;

    return async (input: { event: { type: string; properties?: Record<string, unknown> } }) => {
        const { event } = input;

        // Pass events to ParallelAgentManager
        try {
            const manager = ParallelAgentManager.getInstance();
            manager.handleEvent(event as { type: string; properties?: { sessionID?: string; info?: { id?: string } } });
        } catch {
            // Manager not initialized
        }

        // session.created
        if (event.type === SESSION_EVENTS.CREATED) {
            const sessionID = event.properties?.id as string || "";
            Toast.presets.missionStarted(`Session ${sessionID.slice(0, 12)}...`);
        }

        // session.deleted
        if (event.type === SESSION_EVENTS.DELETED) {
            const sessionID = (event.properties?.id as string) ||
                (event.properties as { info?: { id?: string } })?.info?.id || "";
            const session = sessions.get(sessionID);
            if (session) {
                const totalTime = Date.now() - session.startTime;
                const duration = totalTime < 60000
                    ? `${Math.round(totalTime / 1000)}s`
                    : `${Math.round(totalTime / 60000)}m`;

                sessions.delete(sessionID);
                state.sessions.delete(sessionID);
                ProgressTracker.clearSession(sessionID);
                SessionRecovery.cleanupSessionRecovery(sessionID);
                TodoContinuation.cleanupSession(sessionID);
                MissionLoopHandler.cleanupSession(sessionID);
                ContextMonitor.cleanupSession(sessionID);

                Toast.presets.sessionCompleted(sessionID, duration);
            }
        }

        // session.error
        if (event.type === SESSION_EVENTS.ERROR) {
            const sessionID = event.properties?.sessionId as string || event.properties?.sessionID as string || "";
            const error = event.properties?.error;

            if (sessionID) {
                TodoContinuation.handleSessionError(sessionID, error);
                MissionLoopHandler.handleAbort(sessionID);
            }

            if (sessionID && error) {
                const recovered = await SessionRecovery.handleSessionError(
                    client, sessionID, error, event.properties
                );
                if (recovered) return;
            }

            Toast.presets.taskFailed("session", String(error).slice(0, 50));
        }

        // message.updated
        if (event.type === MESSAGE_EVENTS.UPDATED) {
            const messageProperties = event.properties as {
                sessionID?: string;
                info?: {
                    id?: string;
                    sessionID?: string;
                    role?: string;
                    time?: { completed?: number };
                };
                usage?: { totalTokens?: number; inputTokens?: number; outputTokens?: number };
            };

            const messageInfo = messageProperties?.info;
            const sessionID = messageProperties.sessionID || messageInfo?.sessionID;
            const role = messageInfo?.role;

            // Context Window Monitoring integration
            // Use the usage data from the event to check against thresholds
            if (sessionID && messageProperties?.usage) {
                const totalTokens = messageProperties.usage.totalTokens ??
                    ((messageProperties.usage.inputTokens ?? 0) + (messageProperties.usage.outputTokens ?? 0));

                if (totalTokens > 0) {
                    // This function has built-in cooldowns so it won't spam
                    ContextMonitor.checkContextWindow(sessionID, totalTokens);
                }
            }

            if (sessionID && role === MESSAGE_ROLES.ASSISTANT) {
                SessionRecovery.markRecoveryComplete(sessionID);
                if (messageInfo?.id && messageInfo.time?.completed) {
                    markAssistantCompleted(sessions, sessionID);
                    await handleCompletedAssistantMessage(ctx, sessionID, messageInfo.id);
                }
            }

            if (sessionID && role === MESSAGE_ROLES.USER) {
                TodoContinuation.handleUserMessage(sessionID);
                MissionLoopHandler.handleUserMessage(sessionID);
            }
        }

        // session.idle
        if (event.type === SESSION_EVENTS.IDLE) {
            const sessionID = event.properties?.sessionID as string || "";
            if (sessionID) {
                scheduleIdleContinuation(ctx, sessionID);
            }
        }

        if (event.type === SESSION_EVENTS.STATUS) {
            const properties = event.properties as { sessionID?: string; status?: { type?: string } } | undefined;
            const sessionID = properties?.sessionID ?? "";
            if (sessionID && properties?.status?.type === "idle") {
                scheduleIdleContinuation(ctx, sessionID);
            }
        }
    };
}

function markAssistantCompleted(sessions: Map<string, SessionState>, sessionID: string): void {
    const session = sessions.get(sessionID);
    if (!session) return;

    session.lastAssistantCompletedAt = Date.now();
}

function shouldContinueAfterIdle(session: SessionState | undefined): boolean {
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

function markAbort(sessions: Map<string, SessionState>, sessionID: string): void {
    const session = sessions.get(sessionID);
    if (session) {
        session.lastAbortAt = Date.now();
    }
    TodoContinuation.handleAbort(sessionID);
    MissionLoopHandler.handleAbort(sessionID);
}

function scheduleIdleContinuation(ctx: EventHandlerContext, sessionID: string): void {
    const { client, directory, sessions } = ctx;
    if (!sessions.has(sessionID)) return;

    setTimeout(async () => {
        const session = sessions.get(sessionID);
        if (!shouldContinueAfterIdle(session)) {
            markAbort(sessions, sessionID);
            return;
        }

        if (isLoopActive(directory, sessionID)) {
            try {
                await MissionLoopHandler.handleMissionIdle(
                    client, directory, sessionID, sessionID
                );
            } catch {
                // Continuation failures must not break the OpenCode event pipeline.
            }
            return;
        }

        try {
            await TodoContinuation.handleSessionIdle(
                client, directory, sessionID, sessionID
            );
        } catch {
            // Continuation failures must not break the OpenCode event pipeline.
        }
    }, 500);
}
