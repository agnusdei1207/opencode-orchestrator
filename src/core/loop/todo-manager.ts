/**
 * TodoManager - Intelligent Incremental TODO Updates
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PATHS, TODO_CONSTANTS } from "../../shared/index.js";
import { log } from "../agents/logger.js";

export class TodoManager {
    private static instance: TodoManager;
    private directory: string = "";

    private constructor() { }

    public static getInstance(): TodoManager {
        if (!TodoManager.instance) {
            TodoManager.instance = new TodoManager();
        }
        return TodoManager.instance;
    }

    public setDirectory(dir: string): void {
        this.directory = dir;
    }

    /**
     * Update a specific TODO item by its text content
     */
    public updateItem(searchText: string, newStatus: string): boolean {
        const todoPath = join(this.directory, PATHS.TODO);
        if (!existsSync(todoPath)) return false;

        try {
            const content = readFileSync(todoPath, "utf-8");
            const lines = content.split("\n");

            const statusMap: Record<string, string> = {
                [TODO_CONSTANTS.STATUS.PENDING]: TODO_CONSTANTS.MARKERS.PENDING,
                [TODO_CONSTANTS.STATUS.COMPLETED]: TODO_CONSTANTS.MARKERS.COMPLETED,
                [TODO_CONSTANTS.STATUS.PROGRESS]: TODO_CONSTANTS.MARKERS.PROGRESS,
                [TODO_CONSTANTS.STATUS.FAILED]: TODO_CONSTANTS.MARKERS.FAILED,
            };

            const marker = statusMap[newStatus] || TODO_CONSTANTS.MARKERS.PENDING;
            let updated = false;

            const newLines = lines.map(line => {
                // Look for lines like "- [ ] ...searchText..."
                if (line.includes(searchText) && (
                    line.includes(TODO_CONSTANTS.MARKERS.PENDING) ||
                    line.includes(TODO_CONSTANTS.MARKERS.PROGRESS) ||
                    line.includes(TODO_CONSTANTS.MARKERS.COMPLETED) ||
                    line.includes(TODO_CONSTANTS.MARKERS.FAILED)
                )) {
                    updated = true;
                    // Replace existing marker with new one
                    return line.replace(/\[[ x\/\-]\]/, marker);
                }
                return line;
            });

            if (updated) {
                writeFileSync(todoPath, newLines.join("\n"), "utf-8");
                log(`[TodoManager] Updated item: "${searchText}" -> ${newStatus}`);
                return true;
            }

            return false;
        } catch (error) {
            log(`[TodoManager] Error updating TODO: ${error}`);
            return false;
        }
    }

    /**
     * Add a new sub-task under a parent task
     */
    public addSubTask(parentText: string, subTaskText: string): boolean {
        const todoPath = join(this.directory, PATHS.TODO);
        if (!existsSync(todoPath)) return false;

        try {
            const content = readFileSync(todoPath, "utf-8");
            const lines = content.split("\n");
            let parentIndex = -1;
            let parentIndent = "";

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(parentText)) {
                    parentIndex = i;
                    const match = lines[i].match(/^(\s*)/);
                    parentIndent = match ? match[1] : "";
                    break;
                }
            }

            if (parentIndex !== -1) {
                const subTaskIndent = parentIndent + "  ";
                const newLine = `${subTaskIndent}- ${TODO_CONSTANTS.MARKERS.PENDING} ${subTaskText}`;
                lines.splice(parentIndex + 1, 0, newLine);
                writeFileSync(todoPath, lines.join("\n"), "utf-8");
                log(`[TodoManager] Added sub-task: "${subTaskText}" under "${parentText}"`);
                return true;
            }

            return false;
        } catch (error) {
            log(`[TodoManager] Error adding sub-task: ${error}`);
            return false;
        }
    }
}
