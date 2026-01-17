/**
 * Task Hierarchy Interface
 */

import type { TaskNode } from "./task-node.js";

export interface TaskHierarchy {
    rootId: string;
    nodes: Map<string, TaskNode>;
    parallelGroups: Map<string, string[]>;
}
