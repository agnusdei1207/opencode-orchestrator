/**
 * OS Sound Player
 * 
 * Low-level logic for playing sounds on different platforms.
 */

import { execFile } from "node:child_process";
import { log } from "../../agents/logger.js";
import {
    NOTIFICATION_COMMANDS,
    NOTIFICATION_COMMAND_KEYS
} from "../../../shared/notification/os-notify/index.js";
import { type Platform, PLATFORM } from "../../../shared/os/index.js";
import { resolveCommandPath } from "./platform-resolver.js";

const PROCESS_OPTIONS = { windowsHide: true } as const;

function runSoundPlayer(executable: string, args: string[], environment?: NodeJS.ProcessEnv): void {
    execFile(executable, args, {
        ...PROCESS_OPTIONS,
        ...(environment ? { env: environment } : {}),
    }, error => {
        if (error) log(`[session-notify] Sound player failed: ${error}`);
    });
}

async function playDarwin(soundPath: string): Promise<void> {
    // macOS sound is primarily handled by 'sound name' in notifier.ts
    // Only use afplay if a specific custom path is provided
    if (!soundPath) return;

    try {
        const path = await resolveCommandPath(
            NOTIFICATION_COMMAND_KEYS.AFPLAY,
            NOTIFICATION_COMMANDS.AFPLAY
        );
        if (path) runSoundPlayer(path, [soundPath]);
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
            runSoundPlayer(paplay, [soundPath]);
            return;
        }

        const aplay = await resolveCommandPath(
            NOTIFICATION_COMMAND_KEYS.APLAY,
            NOTIFICATION_COMMANDS.APLAY
        );
        if (aplay) runSoundPlayer(aplay, [soundPath]);
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
            runSoundPlayer(ps, [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "[System.Media.SystemSounds]::Asterisk.Play()",
            ]);
        } else {
            runSoundPlayer(ps, [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "(New-Object Media.SoundPlayer $env:OPENCODE_NOTIFICATION_SOUND).PlaySync()",
            ], {
                ...process.env,
                OPENCODE_NOTIFICATION_SOUND: soundPath,
            });
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
