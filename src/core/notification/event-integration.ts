/**
 * Event Bus Integration - Auto-subscribe to events
 */

import {
    EventBus,
    TASK_EVENTS,
    MISSION_EVENTS,
    DOCUMENT_EVENTS
} from "../bus/index.js";
import { presets } from "./presets.js";

/**
 * Auto-subscribe to events and show toasts
 */
export function enableAutoToasts(): () => void {
    const unsubscribers: Array<() => void> = [];

    unsubscribers.push(EventBus.subscribe(TASK_EVENTS.STARTED, (event) => {
        const { taskId, agent } = event.properties as { taskId: string; agent: string };
        presets.taskStarted(taskId, agent);
    }));

    unsubscribers.push(EventBus.subscribe(TASK_EVENTS.COMPLETED, (event) => {
        const { taskId, agent } = event.properties as { taskId: string; agent: string };
        presets.taskCompleted(taskId, agent);
    }));

    unsubscribers.push(EventBus.subscribe(TASK_EVENTS.FAILED, (event) => {
        const { taskId, error } = event.properties as { taskId: string; error: string };
        presets.taskFailed(taskId, error);
    }));

    unsubscribers.push(EventBus.subscribe(MISSION_EVENTS.ALL_TASKS_COMPLETE, (event) => {
        const { count } = event.properties as { count: number };
        presets.allTasksComplete(count);
    }));

    unsubscribers.push(EventBus.subscribe(MISSION_EVENTS.COMPLETE, (event) => {
        const { summary } = event.properties as { summary: string };
        presets.missionComplete(summary);
    }));

    unsubscribers.push(EventBus.subscribe(DOCUMENT_EVENTS.CACHED, (event) => {
        const { filename } = event.properties as { filename: string };
        presets.documentCached(filename);
    }));

    return () => {
        for (const unsub of unsubscribers) {
            unsub();
        }
    };
}
