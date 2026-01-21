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

