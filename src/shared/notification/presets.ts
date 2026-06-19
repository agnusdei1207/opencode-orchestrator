/**
 * Notification presets (consolidated)
 */
import { show } from "../../core/notification/toast-core.js";
import { TOAST_VARIANTS } from "./constants.js";
import { PATHS, STATUS_LABEL, TOAST_DURATION } from "../index.js";

/**
 * Task Lifecycle Presets
 */


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

export const allTasksComplete = (count: number) => show({
    title: "All Tasks Complete",
    message: `${count} tasks finished successfully`,
    variant: TOAST_VARIANTS.SUCCESS,
    duration: 5000,
});


/**
 * Session Management Presets
 */


export const sessionCreated = (sessionId: string, agent: string) => show({
    title: "Session Created",
    message: `${agent} - ${sessionId.slice(0, 12)}...`,
    variant: STATUS_LABEL.INFO,
    duration: TOAST_DURATION.SHORT,
});

export const sessionResumed = (sessionId: string, agent: string) => show({
    title: "Session Resumed",
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


/**
 * Parallel Processing Presets
 */


export const parallelTasksLaunched = (count: number, agents: string[]) => show({
    title: "Parallel Tasks Launched",
    message: `${count} tasks: ${agents.join(", ")}`,
    variant: "info",
    duration: TOAST_DURATION.DEFAULT,
});

export const concurrencyAcquired = (agent: string, slot: string) => show({
    title: "Concurrency Slot",
    message: `${agent} acquired ${slot}`,
    variant: "info",
    duration: TOAST_DURATION.SHORT,
});

export const concurrencyReleased = (agent: string) => show({
    title: "Slot Released",
    message: agent,
    variant: "info",
    duration: TOAST_DURATION.EXTRA_SHORT,
});


/**
 * Mission & Progress Presets
 */


export const missionComplete = (summary: string) => show({
    title: "Mission Complete",
    message: summary,
    variant: TOAST_VARIANTS.SUCCESS,
    duration: 0,
});

export const missionStarted = (description: string) => show({
    title: "Mission Started",
    message: description.slice(0, 100),
    variant: TOAST_VARIANTS.INFO,
    duration: 4000,
});


/**
 * Tools & Research Presets
 */


export const toolExecuted = (toolName: string, target: string) => show({
    title: toolName,
    message: target.slice(0, 80),
    variant: "info",
    duration: TOAST_DURATION.SHORT,
});

export const documentCached = (filename: string) => show({
    title: "Document Cached",
    message: `${PATHS.DOCS}/${filename}`,
    variant: "info",
    duration: TOAST_DURATION.SHORT,
});

export const researchStarted = (topic: string) => show({
    title: "Research Started",
    message: topic,
    variant: "info",
    duration: TOAST_DURATION.MEDIUM,
});


/**
 * Warnings & Errors Presets
 */


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

export const warningMaxDepth = (depth: number) => show({
    title: "Max Depth Reached",
    message: `Recursion blocked at depth ${depth}`,
    variant: "warning",
    duration: TOAST_DURATION.LONG,
});

export const warningMaxRetries = () => show({
    title: "Max Retries Exceeded",
    message: "Automatic recovery has stopped. Manual intervention may be needed.",
    variant: "error",
    duration: TOAST_DURATION.PERSISTENT,
});


