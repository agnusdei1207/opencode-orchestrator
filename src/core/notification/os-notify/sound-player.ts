/**
 * OS Sound Player
 * 
 * Low-level logic for playing sounds on different platforms.
 */

import { exec } from "node:child_process";
import { log } from "../../agents/logger.js";
import {
    NOTIFICATION_COMMANDS,
    NOTIFICATION_COMMAND_KEYS
} from "../../../shared/notification/os-notify/index.js";
import { type Platform, PLATFORM } from "../../../shared/os/index.js";
import { resolveCommandPath } from "./platform-resolver.js";

async function playDarwin(soundPath: string): Promise<void> {
    // macOS sound is primarily handled by 'sound name' in notifier.ts
    // Only use afplay if a specific custom path is provided
    if (!soundPath) return;

    try {
        const path = await resolveCommandPath(
            NOTIFICATION_COMMAND_KEYS.AFPLAY,
            NOTIFICATION_COMMANDS.AFPLAY
        );
        if (path) exec(`"${path}" "${soundPath}"`);
    } catch (err) {
        log(`[session-notify] Error playing sound (Darwin): ${err}`);
    }
}

async function playLinux(soundPath: string): Promise<void> {
    // Linux doesn't have a universal 'system sound' name, so only play if path exists
    if (!soundPath) return;

    try {
        const paplay = await resolveCommandPath(
            NOTIFICATION_COMMAND_KEYS.PAPLAY,
            NOTIFICATION_COMMANDS.PAPLAY
        );
        if (paplay) {
            exec(`"${paplay}" "${soundPath}" 2>/dev/null`);
            return;
        }

        const aplay = await resolveCommandPath(
            NOTIFICATION_COMMAND_KEYS.APLAY,
            NOTIFICATION_COMMANDS.APLAY
        );
        if (aplay) exec(`"${aplay}" "${soundPath}" 2>/dev/null`);
    } catch (err) {
        log(`[session-notify] Error playing sound (Linux): ${err}`);
    }
}

async function playWindows(soundPath: string): Promise<void> {
    try {
        const ps = await resolveCommandPath(
            NOTIFICATION_COMMAND_KEYS.POWERSHELL,
            NOTIFICATION_COMMANDS.POWERSHELL
        );
        if (!ps) return;

        // Use system built-in sound if no path is provided
        if (!soundPath) {
            exec(`"${ps}" -Command "[System.Media.SystemSounds]::Asterisk.Play()"`);
        } else {
            const escaped = soundPath.replace(/'/g, "''");
            exec(`"${ps}" -Command "(New-Object Media.SoundPlayer '${escaped}').PlaySync()"`);
        }
    } catch (err) {
        log(`[session-notify] Error playing sound (Windows): ${err}`);
    }
}

export async function playSound(platform: Platform, soundPath: string): Promise<void> {
    switch (platform) {
        case PLATFORM.DARWIN: return playDarwin(soundPath);
        case PLATFORM.LINUX: return playLinux(soundPath);
        case PLATFORM.WIN32: return playWindows(soundPath);
        default: break;
    }
}
