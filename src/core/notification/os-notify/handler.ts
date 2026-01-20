/**
 * Session Notification Handler
 * 
 * High-level orchestration for session idle notifications.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../../agents/logger.js";
import {
    detectPlatform,
    getDefaultSoundPath,
    preloadPlatformCommands
} from "./platform.js";
import { sendNotification } from "./notifier.js";
import { playSound } from "./sound-player.js";
import { hasIncompleteTodos } from "./todo-checker.js";
import {
    NOTIFICATION_DEFAULTS,
    type NotificationConfig,
    type NotificationState,
} from "../../../shared/notification/os-notify/index.js";
import { type Platform, PLATFORM } from "../../../shared/os/index.js";

export function createSessionNotificationHandler(
    client: PluginInput["client"],
    config: NotificationConfig = {}
) {
    const currentPlatform = detectPlatform();
    const defaultSoundPath = getDefaultSoundPath(currentPlatform);

    preloadPlatformCommands(currentPlatform);

    const mergedConfig: Required<NotificationConfig> = {
        ...NOTIFICATION_DEFAULTS,
        soundPath: defaultSoundPath,
        ...config,
    };

    const state: NotificationState = {
        notifiedSessions: new Set(),
        pendingTimers: new Map(),
        sessionActivitySinceIdle: new Set(),
        notificationVersions: new Map(),
        executingNotifications: new Set(),
    };

    const backgroundSessions = new Set<string>();

    function cleanupOldSessions(): void {
        const max = mergedConfig.maxTrackedSessions;
        const cleanup = (setOrMap: Set<string> | Map<string, any>) => {
            if (setOrMap.size > max) {
                const keys = setOrMap instanceof Set ? Array.from(setOrMap) : Array.from(setOrMap.keys());
                keys.slice(0, setOrMap.size - max).forEach(k => {
                    if (setOrMap instanceof Set) setOrMap.delete(k);
                    else setOrMap.delete(k);
                });
            }
        };
        cleanup(state.notifiedSessions);
        cleanup(state.sessionActivitySinceIdle);
        cleanup(state.notificationVersions);
        cleanup(state.executingNotifications);
    }

    function markSessionActivity(sessionID: string): void {
        const timer = state.pendingTimers.get(sessionID);
        if (timer) {
            clearTimeout(timer);
            state.pendingTimers.delete(sessionID);
        }
        state.sessionActivitySinceIdle.add(sessionID);
        state.notificationVersions.set(sessionID, (state.notificationVersions.get(sessionID) ?? 0) + 1);
        state.notifiedSessions.delete(sessionID);
    }

    async function executeNotification(sessionID: string, version: number): Promise<void> {
        if (state.executingNotifications.has(sessionID)) {
            state.pendingTimers.delete(sessionID);
            return;
        }

        if (state.notificationVersions.get(sessionID) !== version ||
            state.sessionActivitySinceIdle.has(sessionID) ||
            state.notifiedSessions.has(sessionID)) {
            state.pendingTimers.delete(sessionID);
            return;
        }

        state.executingNotifications.add(sessionID);
        try {
            if (mergedConfig.skipIfIncompleteTodos) {
                const pending = await hasIncompleteTodos(client, sessionID);

                // RE-CHECK state after async call (crucial for safety)
                if (state.notificationVersions.get(sessionID) !== version ||
                    state.sessionActivitySinceIdle.has(sessionID)) {
                    return;
                }

                if (pending) {
                    log(`[session-notify] Skipping notification for ${sessionID} - incomplete todos exist`);
                    return;
                }
            }

            if (state.notificationVersions.get(sessionID) !== version ||
                state.sessionActivitySinceIdle.has(sessionID)) return;

            state.notifiedSessions.add(sessionID);
            log(`[session-notify] Triggering OS notification for session: ${sessionID}`);

            await sendNotification(currentPlatform, mergedConfig.title, mergedConfig.message);
            if (mergedConfig.playSound && mergedConfig.soundPath) {
                await playSound(currentPlatform, mergedConfig.soundPath);
            }
        } catch (err) {
            log(`[session-notify] Critical error during notification execution: ${err}`);
        } finally {
            state.executingNotifications.delete(sessionID);
            state.pendingTimers.delete(sessionID);
        }
    }

    return {
        registerBackgroundSession: (id: string) => backgroundSessions.add(id),
        unregisterBackgroundSession: (id: string) => backgroundSessions.delete(id),
        getPlatform: () => currentPlatform,
        getState: () => state as Readonly<NotificationState>,
        handleEvent: async (event: { type: string; properties?: unknown }) => {
            if (currentPlatform === PLATFORM.UNSUPPORTED) return;
            const props = event.properties as Record<string, unknown> | undefined;

            // Expanded activity tracking (Learning from OMO)
            if ([
                "session.updated", "session.created", "session.compacted", "session.error",
                "message.updated", "message.created", "message.deleted",
                "tool.execute.before", "tool.execute.after"
            ].includes(event.type)) {
                const sessionID = (props?.info as any)?.sessionID || (props?.info as any)?.id || props?.sessionID;
                if (sessionID) markSessionActivity(sessionID as string);
                return;
            }

            if (event.type === "session.idle") {
                const sessionID = props?.sessionID as string;
                if (!sessionID || backgroundSessions.has(sessionID) ||
                    state.notifiedSessions.has(sessionID) || state.pendingTimers.has(sessionID) ||
                    state.executingNotifications.has(sessionID)) return;

                state.sessionActivitySinceIdle.delete(sessionID);
                const ver = (state.notificationVersions.get(sessionID) ?? 0) + 1;
                state.notificationVersions.set(sessionID, ver);

                state.pendingTimers.set(sessionID, setTimeout(() => {
                    executeNotification(sessionID, ver).catch(err => {
                        log(`[session-notify] Error in executeNotification: ${err}`);
                    });
                }, mergedConfig.idleConfirmationDelay));

                cleanupOldSessions();
            }

            if (event.type === "session.deleted") {
                const id = (props?.info as any)?.id;
                if (id) {
                    const timer = state.pendingTimers.get(id);
                    if (timer) clearTimeout(timer);
                    state.pendingTimers.delete(id);
                    state.notifiedSessions.delete(id);
                    state.sessionActivitySinceIdle.delete(id);
                    state.notificationVersions.delete(id);
                    state.executingNotifications.delete(id);
                    backgroundSessions.delete(id);
                }
            }
        },
    };
}

export type SessionNotificationHandler = ReturnType<typeof createSessionNotificationHandler>;
