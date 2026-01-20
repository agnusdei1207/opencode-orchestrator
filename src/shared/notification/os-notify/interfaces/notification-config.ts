/**
 * Notification Config Interface
 */

export interface NotificationConfig {
    /** Notification title (default: "OpenCode Orchestrator") */
    title?: string;
    /** Notification message (default: "Agent is ready for input") */
    message?: string;
    /** Play sound with notification (default: true) */
    playSound?: boolean;
    /** Custom sound file path */
    soundPath?: string;
    /** Delay in ms before sending notification to confirm session is still idle (default: 1500) */
    idleConfirmationDelay?: number;
    /** Skip notification if there are incomplete todos (default: true) */
    skipIfIncompleteTodos?: boolean;
    /** Maximum number of sessions to track before cleanup (default: 100) */
    maxTrackedSessions?: number;
}
