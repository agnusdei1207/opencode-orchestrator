/**
 * Task Decomposer
 * 
 * Automatically decomposes complex tasks into hierarchical subtasks
 * Supports parallel grouping and dependency tracking
 */

export interface TaskNode {
    id: string;
    description: string;
    level: number;  // 1, 2, or 3
    parent?: string;
    children: string[];
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    agent?: string;
    parallelGroup?: string;
    dependsOn: string[];
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    result?: string;
}

export interface TaskHierarchy {
    rootId: string;
    nodes: Map<string, TaskNode>;
    parallelGroups: Map<string, string[]>;
}

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
 * Add a task node
 */
export function addTask(
    sessionId: string,
    task: {
        description: string;
        level: number;
        parentId?: string;
        agent?: string;
        parallelGroup?: string;
        dependsOn?: string[];
    }
): TaskNode {
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

    // Add to parent's children
    if (task.parentId) {
        const parent = hierarchy.nodes.get(task.parentId);
        if (parent) {
            parent.children.push(id);
        }
    }

    // Add to parallel group
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
    status: TaskNode["status"],
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
 * Get next executable tasks (respecting dependencies)
 */
export function getNextTasks(sessionId: string): TaskNode[] {
    const hierarchy = hierarchies.get(sessionId);
    if (!hierarchy) return [];

    const executable: TaskNode[] = [];

    for (const node of hierarchy.nodes.values()) {
        if (node.status !== "pending") continue;

        // Check if all dependencies are completed
        const depsComplete = node.dependsOn.every(depId => {
            const dep = hierarchy.nodes.get(depId);
            return dep?.status === "completed";
        });

        // Check if parent is running or completed
        let parentReady = true;
        if (node.parent) {
            const parent = hierarchy.nodes.get(node.parent);
            parentReady = parent?.status === "running" || parent?.status === "completed";
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
    const hierarchy = hierarchies.get(sessionId);
    if (!hierarchy) return [];

    const taskIds = hierarchy.parallelGroups.get(groupId) || [];
    return taskIds
        .map(id => hierarchy.nodes.get(id))
        .filter((node): node is TaskNode =>
            node !== undefined && node.status === "pending"
        );
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
export function getProgress(sessionId: string): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    percentage: number;
} {
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

/**
 * Get hierarchy summary for prompts
 */
export function getSummary(sessionId: string): string {
    const hierarchy = hierarchies.get(sessionId);
    if (!hierarchy) return "";

    const progress = getProgress(sessionId);
    const nextTasks = getNextTasks(sessionId);

    let summary = `## Task Hierarchy Progress\n\n`;
    summary += `📊 **${progress.completed}/${progress.total}** tasks complete (${progress.percentage}%)\n\n`;

    if (nextTasks.length > 0) {
        summary += `### Next Executable Tasks\n`;
        for (const task of nextTasks.slice(0, 5)) {
            summary += `- [L${task.level}] ${task.description}`;
            if (task.agent) summary += ` → ${task.agent}`;
            if (task.parallelGroup) summary += ` (parallel: ${task.parallelGroup})`;
            summary += `\n`;
        }
    }

    return summary;
}

/**
 * Clear hierarchy
 */
export function clear(sessionId: string): void {
    hierarchies.delete(sessionId);
}

/**
 * Parse task hierarchy from text (Architect output)
 */
export function parseFromText(sessionId: string, text: string): TaskHierarchy {
    const hierarchy = create(sessionId, "Parsed Task Hierarchy");

    const lines = text.split("\n");
    const stack: { id: string; level: number }[] = [{ id: hierarchy.rootId, level: 0 }];

    for (const line of lines) {
        // Match patterns like:
        // - [L1] Main objective
        // - [L2] Sub-task | parallel_group:A
        // - [L3] Atomic action | depends:task_1
        const match = line.match(/^\s*[-*]\s*\[L(\d)\]\s*(.+?)(?:\s*\|\s*(.+))?$/);
        if (!match) continue;

        const [, levelStr, description, metadata] = match;
        const level = parseInt(levelStr, 10);

        // Find parent
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
            stack.pop();
        }

        const parentId = stack[stack.length - 1]?.id || hierarchy.rootId;

        // Parse metadata
        let parallelGroup: string | undefined;
        let dependsOn: string[] = [];
        let agent: string | undefined;

        if (metadata) {
            const parts = metadata.split(",").map(p => p.trim());
            for (const part of parts) {
                if (part.startsWith("parallel:") || part.startsWith("parallel_group:")) {
                    parallelGroup = part.split(":")[1];
                } else if (part.startsWith("depends:")) {
                    dependsOn = part.split(":")[1].split(",").map(s => s.trim());
                } else if (part.startsWith("agent:")) {
                    agent = part.split(":")[1];
                }
            }
        }

        const node = addTask(sessionId, {
            description: description.trim(),
            level,
            parentId,
            parallelGroup,
            dependsOn,
            agent,
        });

        stack.push({ id: node.id, level });
    }

    return hierarchy;
}
