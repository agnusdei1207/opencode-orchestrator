/**
 * Plugin Handlers - Event Handler
 * 
 * Handles all OpenCode events:
 * - session.created, session.deleted, session.error, session.idle
 * - message.updated
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../core/agents/logger.js";
import { ParallelAgentManager } from "../core/agents/manager.js";
import * as Toast from "../core/notification/toast.js";
import * as ProgressTracker from "../core/progress/tracker.js";
import * as SessionRecovery from "../core/recovery/session-recovery.js";
import * as TodoContinuation from "../core/loop/todo-continuation.js";
import * as MissionSealHandler from "../core/loop/mission-seal-handler.js";
import { isLoopActive } from "../core/loop/mission-seal.js";

type OpencodeClient = PluginInput["client"];

export interface SessionState {
    active: boolean;
    step: number;
    timestamp: number;
    startTime: number;
    lastStepTime: number;
}

export interface OrchestratorState {
    missionActive: boolean;
    sessions: Map<string, {
        enabled: boolean;
        iterations: number;
        taskRetries: Map<string, number>;
        currentTask: string;
        anomalyCount: number;
        lastHealthyOutput?: string;
    }>;
}

export interface EventHandlerContext {
    client: OpencodeClient;
    directory: string;
    sessions: Map<string, SessionState>;
    state: OrchestratorState;
}

/**
 * Create event handler for session events
 */
export function createEventHandler(ctx: EventHandlerContext) {
    const { client, directory, sessions, state } = ctx;

    return async (input: { event: { type: string; properties?: Record<string, unknown> } }) => {
        const { event } = input;

        // Pass events to ParallelAgentManager for resource cleanup
        try {
            const manager = ParallelAgentManager.getInstance();
            manager.handleEvent(event as { type: string; properties?: { sessionID?: string; info?: { id?: string } } });
        } catch {
            // Manager not initialized yet, ignore
        }

        // Session created event
        if (event.type === "session.created") {
            const sessionID = event.properties?.id as string || "";
            log("[event-handler] session.created", { sessionID });
            Toast.presets.missionStarted(`Session ${sessionID.slice(0, 12)}...`);
        }

        // Session deleted/ended event
        if (event.type === "session.deleted") {
            const sessionID = (event.properties?.id as string) ||
                (event.properties as { info?: { id?: string } })?.info?.id || "";
            const session = sessions.get(sessionID);
            if (session) {
                const totalTime = Date.now() - session.startTime;
                const duration = totalTime < 60000
                    ? `${Math.round(totalTime / 1000)}s`
                    : `${Math.round(totalTime / 60000)}m`;

                log("[event-handler] session.deleted", {
                    sessionID,
                    steps: session.step,
                    duration
                });

                // Cleanup session state
                sessions.delete(sessionID);
                state.sessions.delete(sessionID);
                ProgressTracker.clearSession(sessionID);
                SessionRecovery.cleanupSessionRecovery(sessionID);
                TodoContinuation.cleanupSession(sessionID);

                Toast.presets.sessionCompleted(sessionID, duration);
            }
        }

        // Session error event - attempt automatic recovery
        if (event.type === "session.error") {
            const sessionID = event.properties?.sessionId as string || event.properties?.sessionID as string || "";
            const error = event.properties?.error;
            log("[event-handler] session.error", { sessionID, error });

            // Notify continuation handlers about potential abort
            if (sessionID) {
                TodoContinuation.handleSessionError(sessionID, error);
                MissionSealHandler.handleAbort(sessionID);
            }

            // Try automatic recovery
            if (sessionID && error) {
                const recovered = await SessionRecovery.handleSessionError(
                    client,
                    sessionID,
                    error,
                    event.properties
                );
                if (recovered) {
                    log("[event-handler] auto-recovery initiated", { sessionID });
                    return;
                }
            }

            // Show error toast if recovery not attempted/failed
            Toast.presets.taskFailed("session", String(error).slice(0, 50));
        }

        // Message updated - reset recovery state on successful messages
        if (event.type === "message.updated") {
            const messageInfo = event.properties?.info as { sessionID?: string; role?: string } | undefined;
            const sessionID = messageInfo?.sessionID;
            const role = messageInfo?.role;

            // Assistant message = successful response, reset recovery state
            if (sessionID && role === "assistant") {
                SessionRecovery.markRecoveryComplete(sessionID);
            }
        }

        // Session idle - check for mission seal first, then todo continuation
        if (event.type === "session.idle") {
            const sessionID = event.properties?.sessionID as string || "";
            if (sessionID) {
                const isMainSession = sessions.has(sessionID);
                if (isMainSession) {
                    // Give assistant.done a chance to process first
                    setTimeout(async () => {
                        const session = sessions.get(sessionID);
                        if (session?.active) {
                            // Check for mission seal loop first
                            if (isLoopActive(directory, sessionID)) {
                                await MissionSealHandler.handleMissionSealIdle(
                                    client, directory, sessionID, sessionID
                                ).catch(err => {
                                    log("[event-handler] mission-seal-handler error", err);
                                });
                            } else {
                                // Fall back to todo continuation
                                await TodoContinuation.handleSessionIdle(
                                    client, sessionID, sessionID
                                ).catch(err => {
                                    log("[event-handler] todo-continuation error", err);
                                });
                            }
                        }
                    }, 500);
                }
            }
        }
    };
}
