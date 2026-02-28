/**
 * OS Notification Sender
 * 
 * Low-level logic for sending native notifications.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { log } from "../../agents/logger.js";
import {
    NOTIFICATION_COMMANDS,
    NOTIFICATION_COMMAND_KEYS
} from "../../../shared/notification/os-notify/index.js";
import { type Platform, PLATFORM } from "../../../shared/os/index.js";
import { resolveCommandPath } from "./platform-resolver.js";

const execAsync = promisify(exec);

async function notifyDarwin(title: string, message: string): Promise<void> {
    const path = await resolveCommandPath(
        NOTIFICATION_COMMAND_KEYS.OSASCRIPT,
        NOTIFICATION_COMMANDS.OSASCRIPT
    );
    if (!path) return;
    const escT = title.replace(/"/g, '\\"');
    const escM = message.replace(/"/g, '\\"');
    // Redirect both stdout and stderr to /dev/null to prevent any TUI output corruption
    await execAsync(`${path} -e 'display notification "${escM}" with title "${escT}" sound name "Glass"' >/dev/null 2>/dev/null`);
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
    if (isWSL()) return;

    const path = await resolveCommandPath(
        NOTIFICATION_COMMAND_KEYS.NOTIFY_SEND,
        NOTIFICATION_COMMANDS.NOTIFY_SEND
    );
    // Redirect both stdout and stderr to /dev/null to prevent TUI corruption
    if (path) await execAsync(`${path} "${title}" "${message}" >/dev/null 2>/dev/null`);
}

async function notifyWindows(title: string, message: string): Promise<void> {
    const ps = await resolveCommandPath(
        NOTIFICATION_COMMAND_KEYS.POWERSHELL,
        NOTIFICATION_COMMANDS.POWERSHELL
    );
    if (!ps) return;
    const psT = title.replace(/'/g, "''");
    const psM = message.replace(/'/g, "''");
    const script = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
$Template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$RawXml = [xml] $Template.GetXml()
($RawXml.toast.visual.binding.text | Where-Object {$_.id -eq '1'}).AppendChild($RawXml.CreateTextNode('${psT}')) | Out-Null
($RawXml.toast.visual.binding.text | Where-Object {$_.id -eq '2'}).AppendChild($RawXml.CreateTextNode('${psM}')) | Out-Null
$SerializedXml = New-Object Windows.Data.Xml.Dom.XmlDocument
$SerializedXml.LoadXml($RawXml.OuterXml)
$Toast = [Windows.UI.Notifications.ToastNotification]::new($SerializedXml)
$Notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('OpenCode Orchestrator')
$Notifier.Show($Toast)
`.trim().replace(/\n/g, "; ");
    await execAsync(`${ps} -Command "${script}" >NUL 2>NUL`);
}

export async function sendNotification(platform: Platform, title: string, message: string): Promise<void> {
    try {
        switch (platform) {
            case PLATFORM.DARWIN: return await notifyDarwin(title, message);
            case PLATFORM.LINUX: return await notifyLinux(title, message);
            case PLATFORM.WIN32: return await notifyWindows(title, message);
            default: break;
        }
    } catch (err) {
        log(`[session-notify] Error sending notification: ${err}`);
    }
}
