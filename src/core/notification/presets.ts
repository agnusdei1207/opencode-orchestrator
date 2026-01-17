/**
 * Toast Presets - Common notification messages
 */

import { show } from "./toast-core.js";
import { PATHS } from "../../shared/constants.js";

export const presets = {
    // =========================================
    // Task Lifecycle
    // =========================================
    taskStarted: (taskId: string, agent: string) => show({
        title: "⚡ Task Started",
        message: `${agent}: ${taskId}`,
        variant: "info",
        duration: 3000,
    }),

    taskCompleted: (taskId: string, agent: string) => show({
        title: "✅ Task Completed",
        message: `${agent}: ${taskId}`,
        variant: "success",
        duration: 3000,
    }),

    taskFailed: (taskId: string, error: string) => show({
        title: "❌ Task Failed",
        message: `${taskId}: ${error}`,
        variant: "error",
        duration: 0,  // Persistent
    }),

    allTasksComplete: (count: number) => show({
        title: "🎉 All Tasks Complete",
        message: `${count} tasks finished successfully`,
        variant: "success",
        duration: 5000,
    }),

    // =========================================
    // Session Management
    // =========================================
    sessionCreated: (sessionId: string, agent: string) => show({
        title: "📌 Session Created",
        message: `${agent} → ${sessionId.slice(0, 12)}...`,
        variant: "info",
        duration: 2000,
    }),

    sessionResumed: (sessionId: string, agent: string) => show({
        title: "🔄 Session Resumed",
        message: `${agent} → ${sessionId.slice(0, 12)}...`,
        variant: "info",
        duration: 2000,
    }),

    sessionCompleted: (sessionId: string, duration: string) => show({
        title: "✅ Session Completed",
        message: `${sessionId.slice(0, 12)}... (${duration})`,
        variant: "success",
        duration: 3000,
    }),

    // =========================================
    // Parallel Processing
    // =========================================
    parallelTasksLaunched: (count: number, agents: string[]) => show({
        title: "🚀 Parallel Tasks Launched",
        message: `${count} tasks: ${agents.join(", ")}`,
        variant: "info",
        duration: 4000,
    }),

    concurrencyAcquired: (agent: string, slot: string) => show({
        title: "🔒 Concurrency Slot",
        message: `${agent} acquired ${slot}`,
        variant: "info",
        duration: 2000,
    }),

    concurrencyReleased: (agent: string) => show({
        title: "🔓 Slot Released",
        message: agent,
        variant: "info",
        duration: 1500,
    }),

    // =========================================
    // Mission & Progress
    // =========================================
    missionComplete: (summary: string) => show({
        title: "🎉 Mission Complete",
        message: summary,
        variant: "success",
        duration: 0,
    }),

    missionStarted: (description: string) => show({
        title: "🎯 Mission Started",
        message: description.slice(0, 100),
        variant: "info",
        duration: 4000,
    }),

    // =========================================
    // Tools & Research
    // =========================================
    toolExecuted: (toolName: string, target: string) => show({
        title: `🔧 ${toolName}`,
        message: target.slice(0, 80),
        variant: "info",
        duration: 2000,
    }),

    documentCached: (filename: string) => show({
        title: "📄 Document Cached",
        message: `${PATHS.DOCS}/${filename}`,
        variant: "info",
        duration: 2000,
    }),

    researchStarted: (topic: string) => show({
        title: "🔬 Research Started",
        message: topic,
        variant: "info",
        duration: 3000,
    }),

    // =========================================
    // Warnings & Errors
    // =========================================
    warningRateLimited: () => show({
        title: "⚠️ Rate Limited",
        message: "Waiting before retry...",
        variant: "warning",
        duration: 5000,
    }),

    errorRecovery: (action: string) => show({
        title: "⚠️ Error Recovery",
        message: `Attempting: ${action}`,
        variant: "warning",
        duration: 3000,
    }),

    warningMaxDepth: (depth: number) => show({
        title: "⚠️ Max Depth Reached",
        message: `Recursion blocked at depth ${depth}`,
        variant: "warning",
        duration: 5000,
    }),
};

