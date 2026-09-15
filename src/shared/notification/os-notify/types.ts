/**
 * OS notification types (consolidated)
 */
import { NOTIFICATION_COMMAND_KEYS } from "./constants.js";

/**
 * OS Notification Command Types
 */


export type NotificationCommandKey = typeof NOTIFICATION_COMMAND_KEYS[keyof typeof NOTIFICATION_COMMAND_KEYS];
