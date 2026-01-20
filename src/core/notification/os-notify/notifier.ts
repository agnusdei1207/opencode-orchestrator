/**
 * OS Notification Sender
 * 
 * Low-level logic for sending native notifications.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
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
    await execAsync(`${path} -e 'display notification "${escM}" with title "${escT}" sound name "Glass"'`);
}

async function notifyLinux(title: string, message: string): Promise<void> {
    const path = await resolveCommandPath(
        NOTIFICATION_COMMAND_KEYS.NOTIFY_SEND,
        NOTIFICATION_COMMANDS.NOTIFY_SEND
    );
    if (path) await execAsync(`${path} "${title}" "${message}" 2>/dev/null`);
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
    await execAsync(`${ps} -Command "${script}"`);
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
