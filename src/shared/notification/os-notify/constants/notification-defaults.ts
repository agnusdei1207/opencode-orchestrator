/**
 * OS Notification Default Constants
 */

import type { NotificationConfig } from "../interfaces/notification-config.js";

export const NOTIFICATION_DEFAULTS: Required<NotificationConfig> = {
    title: "OpenCode Orchestrator",
    message: "Agent is ready for input",
    playSound: true,
    soundPath: "",
    idleConfirmationDelay: 1500,
    skipIfIncompleteTodos: true,
    maxTrackedSessions: 100,
};
