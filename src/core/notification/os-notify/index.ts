/**
 * OS Native Notification Module
 */

export * from "../../../shared/notification/os-notify/index.js";
export { sendNotification } from "./notifier.js";
export { playSound } from "./sound-player.js";
export { detectPlatform, getDefaultSoundPath } from "./platform.js";

