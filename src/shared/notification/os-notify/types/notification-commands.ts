/**
 * OS Notification Command Types
 */

import { NOTIFICATION_COMMAND_KEYS } from "../constants/notification-command-keys.js";

export type NotificationCommandKey = typeof NOTIFICATION_COMMAND_KEYS[keyof typeof NOTIFICATION_COMMAND_KEYS];
