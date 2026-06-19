/**
 * OS notification types (consolidated)
 */
import { NOTIFICATION_COMMAND_KEYS } from "./constants.js";

/**
 * Notification Config Interface
 */

export interface NotificationConfig {
    /** Notification title (default: "OpenCode Orchestrator") */
    title?: string;
    /** Notification message (default: "Task completed") */
    message?: string;
    /** Play sound with notification (default: true) */
    playSound?: boolean;
    /** Custom sound file path */
    soundPath?: string;
    /** Maximum number of sessions to track before cleanup (default: 100) */
    maxTrackedSessions?: number;
}


/**
 * Notification State Interface
 */

export interface NotificationState {
    /** Sessions that have already been notified */
    notifiedSessions: Set<string>;
    /** Pending notification timers */
    pendingTimers: Map<string, ReturnType<typeof setTimeout>>;
    /** Version tracking for race condition handling */
    notificationVersions: Map<string, number>;
    /** Sessions currently executing notification */
    executingNotifications: Set<string>;
}


/**
 * OS Notification Command Types
 */


export type NotificationCommandKey = typeof NOTIFICATION_COMMAND_KEYS[keyof typeof NOTIFICATION_COMMAND_KEYS];

