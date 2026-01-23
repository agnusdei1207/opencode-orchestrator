/**
 * Task Lifecycle Presets
 */

import { show } from "../../../core/notification/toast-core.js";
import { TOAST_VARIANTS } from "../constants/index.js";

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

