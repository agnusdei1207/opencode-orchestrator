/**
 * Task Parser - Parse hierarchy from Planner output
 */

import type { TaskHierarchy } from "./interfaces.js";
import { create, addTask, getHierarchy } from "./store.js";
import { TASK_METADATA } from "../../shared/index.js";

/**
 * Parse task hierarchy from text (Planner output)
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
                if (part.startsWith(`${TASK_METADATA.PARALLEL}:`) || part.startsWith(`${TASK_METADATA.PARALLEL_GROUP}:`)) {
                    parallelGroup = part.split(":")[1];
                } else if (part.startsWith(`${TASK_METADATA.DEPENDS}:`)) {
                    dependsOn = part.split(":")[1].split(",").map(s => s.trim());
                } else if (part.startsWith(`${TASK_METADATA.AGENT}:`)) {
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

    return getHierarchy(sessionId)!;
}
