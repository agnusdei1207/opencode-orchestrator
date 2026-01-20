/**
 * OS Platform Utils
 */

import { platform as osPlatform } from "node:os";
import {
    NOTIFICATION_COMMANDS,
    NOTIFICATION_COMMAND_KEYS
} from "../../../shared/notification/os-notify/index.js";
import { type Platform, PLATFORM } from "../../../shared/os/index.js";
import { resolveCommandPath } from "./platform-resolver.js";

export function detectPlatform(): Platform {
    const p = osPlatform();
    if (p === PLATFORM.DARWIN) return PLATFORM.DARWIN;
    if (p === PLATFORM.LINUX) return PLATFORM.LINUX;
    if (p === PLATFORM.WIN32) return PLATFORM.WIN32;
    return PLATFORM.UNSUPPORTED;
}

export function getDefaultSoundPath(p: Platform): string {
    // Return empty by default to use OS-native built-in sounds via commands
    // instead of relying on specific file paths.
    return "";
}

export function preloadPlatformCommands(platform: Platform): void {
    if (platform === PLATFORM.DARWIN) {
        resolveCommandPath(
            NOTIFICATION_COMMAND_KEYS.OSASCRIPT,
            NOTIFICATION_COMMANDS.OSASCRIPT
        ).catch(() => { });
        resolveCommandPath(
            NOTIFICATION_COMMAND_KEYS.AFPLAY,
            NOTIFICATION_COMMANDS.AFPLAY
        ).catch(() => { });
    } else if (platform === PLATFORM.LINUX) {
        resolveCommandPath(
            NOTIFICATION_COMMAND_KEYS.NOTIFY_SEND,
            NOTIFICATION_COMMANDS.NOTIFY_SEND
        ).catch(() => { });
        resolveCommandPath(
            NOTIFICATION_COMMAND_KEYS.PAPLAY,
            NOTIFICATION_COMMANDS.PAPLAY
        ).catch(() => { });
        resolveCommandPath(
            NOTIFICATION_COMMAND_KEYS.APLAY,
            NOTIFICATION_COMMANDS.APLAY
        ).catch(() => { });
    } else if (platform === PLATFORM.WIN32) {
        resolveCommandPath(
            NOTIFICATION_COMMAND_KEYS.POWERSHELL,
            NOTIFICATION_COMMANDS.POWERSHELL
        ).catch(() => { });
    }
}
