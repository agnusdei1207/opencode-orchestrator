/**
 * Platform Command Resolver
 * 
 * Logic for discovering native command paths on the system.
 */

import { execFile } from "node:child_process";
import type { NotificationCommandKey } from "../../../shared/notification/os-notify/index.js";
import { PLATFORM } from "../../../shared/os/index.js";
import { log } from "../../agents/logger.js";

const cache = new Map<NotificationCommandKey, string | null>();
const pending: Map<NotificationCommandKey, Promise<string | null>> = new Map();

async function findCommand(commandName: string): Promise<string | null> {
    const isWindows = process.platform === PLATFORM.WIN32;
    const cmd = isWindows ? "where" : "which";

    try {
        const stdout = await new Promise<string>((resolve, reject) => {
            execFile(cmd, [commandName], {
                encoding: "utf8",
                windowsHide: true,
            }, (error, output) => {
                if (error) reject(error);
                else resolve(output);
            });
        });
        return stdout.trim().split(/\r?\n/)[0] || null;
    } catch (error) {
        log(`[session-notify] Command lookup failed for ${commandName}: ${error}`);
        return null;
    }
}

export async function resolveCommandPath(
    key: NotificationCommandKey,
    commandName: string
): Promise<string | null> {
    if (cache.has(key)) return cache.get(key) ?? null;

    const currentPending = pending.get(key);
    if (currentPending) return currentPending;

    const promise = (async () => {
        const path = await findCommand(commandName);
        cache.set(key, path);
        pending.delete(key);
        return path;
    })();

    pending.set(key, promise);
    return promise;
}
