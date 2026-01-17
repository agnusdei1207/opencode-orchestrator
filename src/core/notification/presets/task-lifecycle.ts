/**
 * Task Lifecycle Presets
 */

import { show } from "../toast-core.js";

export const taskStarted = (taskId: string, agent: string) => show({
    title: "Task Started",
    message: `${agent}: ${taskId}`,
    variant: "info",
    duration: 3000,
});

export const taskCompleted = (taskId: string, agent: string) => show({
    title: "Task Completed",
    message: `${agent}: ${taskId}`,
    variant: "success",
    duration: 3000,
});

export const taskFailed = (taskId: string, error: string) => show({
    title: "Task Failed",
    message: `${taskId}: ${error}`,
    variant: "error",
    duration: 0,
});

export const allTasksComplete = (count: number) => show({
    title: "All Tasks Complete",
    message: `${count} tasks finished successfully`,
    variant: "success",
    duration: 5000,
});
