/**
 * Toast Presets - Common notification messages
 */

import { show } from "./toast-core.js";

export const presets = {
    taskStarted: (taskId: string, agent: string) => show({
        title: "Task Started",
        message: `${agent}: ${taskId}`,
        variant: "info",
        duration: 3000,
    }),

    taskCompleted: (taskId: string, agent: string) => show({
        title: "Task Completed",
        message: `${agent}: ${taskId}`,
        variant: "success",
        duration: 3000,
    }),

    taskFailed: (taskId: string, error: string) => show({
        title: "Task Failed",
        message: `${taskId}: ${error}`,
        variant: "error",
        duration: 0,  // Persistent
    }),

    allTasksComplete: (count: number) => show({
        title: "All Tasks Complete",
        message: `${count} tasks finished successfully`,
        variant: "success",
        duration: 5000,
    }),

    missionComplete: (summary: string) => show({
        title: "🎉 Mission Complete",
        message: summary,
        variant: "success",
        duration: 0,
    }),

    documentCached: (filename: string) => show({
        title: "Document Cached",
        message: `.cache/docs/${filename}`,
        variant: "info",
        duration: 2000,
    }),

    researchStarted: (topic: string) => show({
        title: "Research Started",
        message: topic,
        variant: "info",
        duration: 3000,
    }),

    warningRateLimited: () => show({
        title: "Rate Limited",
        message: "Waiting before retry...",
        variant: "warning",
        duration: 5000,
    }),

    errorRecovery: (action: string) => show({
        title: "Error Recovery",
        message: `Attempting: ${action}`,
        variant: "warning",
        duration: 3000,
    }),
};
