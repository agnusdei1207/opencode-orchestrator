/**
 * Platform Command Resolver
 * 
 * Logic for discovering native command paths on the system.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
    NOTIFICATION_COMMAND_KEYS,
    type NotificationCommandKey,
} from "../../../shared/notification/os-notify/index.js";
import { PLATFORM } from "../../../shared/os/index.js";

const execAsync = promisify(exec);

const cache: Record<NotificationCommandKey, string | null> = {
    [NOTIFICATION_COMMAND_KEYS.OSASCRIPT]: null,
    [NOTIFICATION_COMMAND_KEYS.NOTIFY_SEND]: null,
    [NOTIFICATION_COMMAND_KEYS.POWERSHELL]: null,
    [NOTIFICATION_COMMAND_KEYS.AFPLAY]: null,
    [NOTIFICATION_COMMAND_KEYS.PAPLAY]: null,
    [NOTIFICATION_COMMAND_KEYS.APLAY]: null,
};

const pending: Map<NotificationCommandKey, Promise<string | null>> = new Map();

async function findCommand(commandName: string): Promise<string | null> {
    const isWindows = process.platform === PLATFORM.WIN32;
    const cmd = isWindows ? "where" : "which";

    try {
        const { stdout } = await execAsync(`${cmd} ${commandName}`);
        return stdout.trim().split("\n")[0] || null;
    } catch {
        return null;
    }
}

export async function resolveCommandPath(
    key: NotificationCommandKey,
    commandName: string
): Promise<string | null> {
    if (cache[key] !== null) return cache[key];

    const currentPending = pending.get(key);
    if (currentPending) return currentPending;

    const promise = (async () => {
        const path = await findCommand(commandName);
        cache[key] = path;
        pending.delete(key);
        return path;
    })();

    pending.set(key, promise);
    return promise;
}
