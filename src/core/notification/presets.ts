/**
 * Notification presets
 */
import { STATUS_LABEL, TOAST_DURATION, TOAST_VARIANTS } from "../../shared/index.js";
import { show } from "./toast-core.js";

export const taskStarted = (taskId: string, agent: string) => show({
    title: "Task Started",
    message: `${agent}: ${taskId}`,
    variant: TOAST_VARIANTS.INFO,
    duration: 3000,
});

export const taskCompleted = (taskId: string, agent: string) => show({
    title: "Task Completed",
    message: `${agent}: ${taskId}`,
    variant: TOAST_VARIANTS.SUCCESS,
    duration: 3000,
});

export const taskFailed = (taskId: string, error: string) => show({
    title: "Task Failed",
    message: `${taskId}: ${error}`,
    variant: TOAST_VARIANTS.ERROR,
    duration: 0,
});

export const sessionCreated = (sessionId: string, agent: string) => show({
    title: "Session Created",
    message: `${agent} - ${sessionId.slice(0, 12)}...`,
    variant: STATUS_LABEL.INFO,
    duration: TOAST_DURATION.SHORT,
});

export const sessionCompleted = (sessionId: string, duration: string) => show({
    title: "Session Completed",
    message: `${sessionId.slice(0, 12)}... (${duration})`,
    variant: STATUS_LABEL.SUCCESS,
    duration: TOAST_DURATION.MEDIUM,
});

export const missionStarted = (description: string) => show({
    title: "Mission Started",
    message: description.slice(0, 100),
    variant: TOAST_VARIANTS.INFO,
    duration: 4000,
});

export const warningRateLimited = () => show({
    title: "Rate Limited",
    message: "Waiting before retry...",
    variant: "warning",
    duration: TOAST_DURATION.LONG,
});

export const errorRecovery = (action: string) => show({
    title: "Error Recovery",
    message: `Attempting: ${action}`,
    variant: "warning",
    duration: TOAST_DURATION.MEDIUM,
});

export const warningMaxRetries = () => show({
    title: "Max Retries Exceeded",
    message: "Automatic recovery has stopped. Manual intervention may be needed.",
    variant: "error",
    duration: TOAST_DURATION.PERSISTENT,
});
