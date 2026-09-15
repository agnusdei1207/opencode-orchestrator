/**
 * OS Notification Sender
 * 
 * Low-level logic for sending native notifications.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { log } from "../../agents/logger.js";
import {
    NOTIFICATION_COMMANDS,
    NOTIFICATION_COMMAND_KEYS
} from "../../../shared/notification/os-notify/index.js";
import { type Platform, PLATFORM } from "../../../shared/os/index.js";
import { resolveCommandPath } from "./platform-resolver.js";

const execFileAsync = promisify(execFile);
const PROCESS_OPTIONS = { windowsHide: true } as const;

async function notifyDarwin(title: string, message: string): Promise<void> {
    const path = await resolveCommandPath(
        NOTIFICATION_COMMAND_KEYS.OSASCRIPT,
        NOTIFICATION_COMMANDS.OSASCRIPT
    );
    if (!path) {
        logMissingCommand(NOTIFICATION_COMMANDS.OSASCRIPT, PLATFORM.DARWIN);
        return;
    }
    await execFileAsync(path, [
        "-e", "on run argv",
        "-e", 'display notification (item 2 of argv) with title (item 1 of argv) sound name "Glass"',
        "-e", "end run",
        title,
        message,
    ], PROCESS_OPTIONS);
}

function isWSL(): boolean {
    try {
        // Check for WSL via environment variable (set by WSL itself)
        if (process.env.WSL_DISTRO_NAME || process.env.WSLENV) return true;
        // Fallback: check /proc/version for Microsoft/WSL kernel string
        const procVersion = readFileSync("/proc/version", "utf-8");
        return /microsoft|WSL/i.test(procVersion);
    } catch {
        return false;
    }
}

async function notifyLinux(title: string, message: string): Promise<void> {
    // Skip notifications in WSL2: notify-send output leaks into the TUI terminal
    // causing visual corruption (issue #24)
    if (isWSL()) {
        log("[session-notify] Skipping Linux notification in WSL");
        return;
    }

    const path = await resolveCommandPath(
        NOTIFICATION_COMMAND_KEYS.NOTIFY_SEND,
        NOTIFICATION_COMMANDS.NOTIFY_SEND
    );
    if (!path) {
        logMissingCommand(NOTIFICATION_COMMANDS.NOTIFY_SEND, PLATFORM.LINUX);
        return;
    }

    await execFileAsync(path, [title, message], PROCESS_OPTIONS);
}

async function notifyWindows(title: string, message: string): Promise<void> {
    const ps = await resolveCommandPath(
        NOTIFICATION_COMMAND_KEYS.POWERSHELL,
        NOTIFICATION_COMMANDS.POWERSHELL
    );
    if (!ps) {
        logMissingCommand(NOTIFICATION_COMMANDS.POWERSHELL, PLATFORM.WIN32);
        return;
    }
    const script = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
$Template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$RawXml = [xml] $Template.GetXml()
($RawXml.toast.visual.binding.text | Where-Object {$_.id -eq '1'}).AppendChild($RawXml.CreateTextNode($env:OPENCODE_NOTIFICATION_TITLE)) | Out-Null
($RawXml.toast.visual.binding.text | Where-Object {$_.id -eq '2'}).AppendChild($RawXml.CreateTextNode($env:OPENCODE_NOTIFICATION_MESSAGE)) | Out-Null
$SerializedXml = New-Object Windows.Data.Xml.Dom.XmlDocument
$SerializedXml.LoadXml($RawXml.OuterXml)
$Toast = [Windows.UI.Notifications.ToastNotification]::new($SerializedXml)
$Notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('OpenCode Orchestrator')
$Notifier.Show($Toast)
`.trim().replace(/\n/g, "; ");
    await execFileAsync(ps, ["-NoProfile", "-NonInteractive", "-Command", script], {
        ...PROCESS_OPTIONS,
        env: {
            ...process.env,
            OPENCODE_NOTIFICATION_TITLE: title,
            OPENCODE_NOTIFICATION_MESSAGE: message,
        },
    });
}

export async function sendNotification(platform: Platform, title: string, message: string): Promise<void> {
    try {
        switch (platform) {
            case PLATFORM.DARWIN: return await notifyDarwin(title, message);
            case PLATFORM.LINUX: return await notifyLinux(title, message);
            case PLATFORM.WIN32: return await notifyWindows(title, message);
            default:
                log(`[session-notify] Unsupported notification platform: ${platform}`);
                break;
        }
    } catch (err) {
        log(`[session-notify] Error sending notification: ${err}`);
    }
}

function logMissingCommand(commandName: string, platform: Platform): void {
    log(`[session-notify] Command not found for ${platform} notification: ${commandName}`);
}
