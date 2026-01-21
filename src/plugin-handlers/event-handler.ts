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
import * as MissionSealHandler from "../core/loop/mission-seal-handler.js";
import { isLoopActive } from "../core/loop/mission-seal.js";
import * as ContextMonitor from "../core/context/index.js";
import { SESSION_EVENTS, MESSAGE_EVENTS, MESSAGE_ROLES } from "../shared/index.js";
import type { EventHandlerContext } from "./interfaces/index.js";

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
                MissionSealHandler.cleanupSession(sessionID);
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
                MissionSealHandler.handleAbort(sessionID);
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
                info?: { sessionID?: string; role?: string };
                usage?: { totalTokens?: number; inputTokens?: number; outputTokens?: number };
            };

            const messageInfo = messageProperties?.info;
            const sessionID = messageInfo?.sessionID;
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
            }

            if (sessionID && role === MESSAGE_ROLES.USER) {
                TodoContinuation.handleUserMessage(sessionID);
                MissionSealHandler.handleUserMessage(sessionID);
            }
        }

        // session.idle
        if (event.type === SESSION_EVENTS.IDLE) {
            const sessionID = event.properties?.sessionID as string || "";
            if (sessionID) {
                const isMainSession = sessions.has(sessionID);
                if (isMainSession) {
                    setTimeout(async () => {
                        const session = sessions.get(sessionID);
                        if (session?.active) {
                            if (isLoopActive(directory, sessionID)) {
                                await MissionSealHandler.handleMissionSealIdle(
                                    client, directory, sessionID, sessionID
                                ).catch(() => { });
                            } else {
                                await TodoContinuation.handleSessionIdle(
                                    client, sessionID, sessionID
                                ).catch(() => { });
                            }
                        }
                    }, 500);
                }
            }
        }
    };
}
