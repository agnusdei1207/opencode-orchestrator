/**
 * OS Platform Utils
 */

import { platform as osPlatform } from "node:os";
import { type Platform, PLATFORM } from "../../../shared/os/index.js";

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

