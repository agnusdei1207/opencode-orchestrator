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

