/**
 * Task Store - Hierarchy data management
 */

import type { TaskNode, TaskHierarchy, TaskInput, TaskStatus, TaskProgress } from "./interfaces.js";

// Store task hierarchies by session
const hierarchies = new Map<string, TaskHierarchy>();

/**
 * Create a new task hierarchy
 */
export function create(sessionId: string, rootDescription: string): TaskHierarchy {
    const rootId = `task_root_${Date.now()}`;

    const root: TaskNode = {
        id: rootId,
        description: rootDescription,
        level: 0,
        children: [],
        status: "pending",
        dependsOn: [],
        createdAt: new Date(),
    };

    const hierarchy: TaskHierarchy = {
        rootId,
        nodes: new Map([[rootId, root]]),
        parallelGroups: new Map(),
    };

    hierarchies.set(sessionId, hierarchy);
    return hierarchy;
}

/**
 * Get hierarchy for session
 */
export function getHierarchy(sessionId: string): TaskHierarchy | undefined {
    return hierarchies.get(sessionId);
}

/**
 * Add a task node
 */
export function addTask(sessionId: string, task: TaskInput): TaskNode {
    const hierarchy = hierarchies.get(sessionId);
    if (!hierarchy) {
        throw new Error(`No hierarchy found for session: ${sessionId}`);
    }

    const id = `task_${task.level}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const node: TaskNode = {
        id,
        description: task.description,
        level: task.level,
        parent: task.parentId,
        children: [],
        status: "pending",
        agent: task.agent,
        parallelGroup: task.parallelGroup,
        dependsOn: task.dependsOn || [],
        createdAt: new Date(),
    };

    hierarchy.nodes.set(id, node);

    if (task.parentId) {
        const parent = hierarchy.nodes.get(task.parentId);
        if (parent) {
            parent.children.push(id);
        }
    }

    if (task.parallelGroup) {
        if (!hierarchy.parallelGroups.has(task.parallelGroup)) {
            hierarchy.parallelGroups.set(task.parallelGroup, []);
        }
        hierarchy.parallelGroups.get(task.parallelGroup)!.push(id);
    }

    return node;
}

/**
 * Update task status
 */
export function updateStatus(
    sessionId: string,
    taskId: string,
    status: TaskStatus,
    result?: string
): void {
    const hierarchy = hierarchies.get(sessionId);
    if (!hierarchy) return;

    const node = hierarchy.nodes.get(taskId);
    if (!node) return;

    node.status = status;

    if (status === "running" && !node.startedAt) {
        node.startedAt = new Date();
    }

    if ((status === "completed" || status === "failed" || status === "cancelled") && !node.completedAt) {
        node.completedAt = new Date();
    }

    if (result) {
        node.result = result;
    }
}

/**
 * Clear hierarchy
 */
export function clear(sessionId: string): void {
    hierarchies.delete(sessionId);
}

/**
 * Check if all tasks are complete
 */
export function isComplete(sessionId: string): boolean {
    const hierarchy = hierarchies.get(sessionId);
    if (!hierarchy) return true;

    for (const node of hierarchy.nodes.values()) {
        if (node.status === "pending" || node.status === "running") {
            return false;
        }
    }
    return true;
}

/**
 * Get progress statistics
 */
export function getProgress(sessionId: string): TaskProgress {
    const hierarchy = hierarchies.get(sessionId);
    if (!hierarchy) {
        return { total: 0, pending: 0, running: 0, completed: 0, failed: 0, percentage: 0 };
    }

    let pending = 0, running = 0, completed = 0, failed = 0;

    for (const node of hierarchy.nodes.values()) {
        switch (node.status) {
            case "pending": pending++; break;
            case "running": running++; break;
            case "completed": completed++; break;
            case "failed":
            case "cancelled": failed++; break;
        }
    }

    const total = hierarchy.nodes.size;
    const done = completed + failed;
    const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

    return { total, pending, running, completed, failed, percentage };
}
