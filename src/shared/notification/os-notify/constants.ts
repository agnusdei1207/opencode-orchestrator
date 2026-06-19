/**
 * OS notification constants (consolidated)
 */
import type { NotificationConfig } from "./types.js";

/**
 * OS Notification Command Keys
 */

export const NOTIFICATION_COMMAND_KEYS = {
    OSASCRIPT: "osascript",
    NOTIFY_SEND: "notifySend",
    POWERSHELL: "powershell",
    AFPLAY: "afplay",
    PAPLAY: "paplay",
    APLAY: "aplay",
} as const;

/**
 * OS Notification Commands
 */

export const NOTIFICATION_COMMANDS = {
    OSASCRIPT: "osascript",
    NOTIFY_SEND: "notify-send",
    POWERSHELL: "powershell",
    AFPLAY: "afplay",
    PAPLAY: "paplay",
    APLAY: "aplay",
} as const;

/**
 * OS Notification Default Constants
 */


export const NOTIFICATION_DEFAULTS: Required<NotificationConfig> = {
    title: "OpenCode Orchestrator",
    message: "Task completed",
    playSound: true,
    soundPath: "",
    maxTrackedSessions: 100,
};

