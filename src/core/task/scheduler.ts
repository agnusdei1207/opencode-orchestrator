/**
 * Task Scheduler - Execution order and dependencies
 */

import type { TaskNode } from "./interfaces.js";
import { getHierarchy } from "./store.js";
import { TASK_STATUS } from "../../shared/constants.js";

/**
 * Get next executable tasks (respecting dependencies)
 */
export function getNextTasks(sessionId: string): TaskNode[] {
    const hierarchy = getHierarchy(sessionId);
    if (!hierarchy) return [];

    const executable: TaskNode[] = [];

    for (const node of hierarchy.nodes.values()) {
        if (node.status !== TASK_STATUS.PENDING) continue;

        // Check if all dependencies are completed
        const depsComplete = node.dependsOn.every(depId => {
            const dep = hierarchy.nodes.get(depId);
            return dep?.status === TASK_STATUS.COMPLETED;
        });

        // Check if parent is running or completed
        let parentReady = true;
        if (node.parent) {
            const parent = hierarchy.nodes.get(node.parent);
            parentReady = parent?.status === TASK_STATUS.RUNNING || parent?.status === TASK_STATUS.COMPLETED;
        }

        if (depsComplete && parentReady) {
            executable.push(node);
        }
    }

    return executable;
}

/**
 * Get parallel group tasks that can run together
 */
export function getParallelBatch(sessionId: string, groupId: string): TaskNode[] {
    const hierarchy = getHierarchy(sessionId);
    if (!hierarchy) return [];

    const taskIds = hierarchy.parallelGroups.get(groupId) || [];
    return taskIds
        .map(id => hierarchy.nodes.get(id))
        .filter((node): node is TaskNode =>
            node !== undefined && node.status === TASK_STATUS.PENDING
        );
}
