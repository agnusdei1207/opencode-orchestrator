/**
 * TodoManager - incremental edits to a project's .opencode/todo.md for the
 * update_todo tool. Writes to one file are serialized and replace it atomically.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { PATHS, TODO_CONSTANTS } from "../../shared/index.js";
import { atomicWrite } from "../knowledge/mission-note.js";

/** Any checkbox updateItem can rewrite; editors commonly write `[X]` as well as `[x]`. */
const CHECKBOX_PATTERN = /\[[ xX\/\-]\]/;

const STATUS_MARKERS = new Map<string, string>([
    [TODO_CONSTANTS.STATUS.PENDING, TODO_CONSTANTS.MARKERS.PENDING],
    [TODO_CONSTANTS.STATUS.COMPLETED, TODO_CONSTANTS.MARKERS.COMPLETED],
    [TODO_CONSTANTS.STATUS.PROGRESS, TODO_CONSTANTS.MARKERS.PROGRESS],
    [TODO_CONSTANTS.STATUS.FAILED, TODO_CONSTANTS.MARKERS.FAILED],
]);

function markerForStatus(status: string): string {
    const marker = STATUS_MARKERS.get(status);
    if (marker === undefined) {
        throw new Error(`Unknown TODO status "${status}". Expected one of: ${[...STATUS_MARKERS.keys()].join(", ")}`);
    }
    return marker;
}

/** Empty or blank text is contained in every line, so it never identifies a task. */
function isUsableSearchText(text: string): boolean {
    return text.trim().length > 0;
}

/**
 * One manager per project directory. A single OpenCode process can serve several
 * directories at once, so a shared instance would write one project's TODO into
 * another, and its lock must only serialize writes to the same file.
 */
export class TodoManager {
    private static readonly instances = new Map<string, TodoManager>();
    private readonly todoPath: string;
    private lock: Promise<unknown> = Promise.resolve();

    private constructor(directory: string) {
        this.todoPath = path.join(directory, PATHS.TODO);
    }

    public static getInstance(directory: string): TodoManager {
        const key = path.resolve(directory);
        let manager = TodoManager.instances.get(key);
        if (!manager) {
            manager = new TodoManager(key);
            TodoManager.instances.set(key, manager);
        }
        return manager;
    }

    /** Set the status marker of the first checkbox line containing the text. */
    public updateItem(searchText: string, newStatus: string): Promise<boolean> {
        const marker = markerForStatus(newStatus);
        if (!isUsableSearchText(searchText)) return Promise.resolve(false);
        return this.edit(lines => {
            const index = lines.findIndex(line => line.includes(searchText) && CHECKBOX_PATTERN.test(line));
            if (index === -1) return false;
            lines[index] = lines[index].replace(CHECKBOX_PATTERN, marker);
            return true;
        });
    }

    /** Insert a pending sub-task under the first line containing the parent text. */
    public addSubTask(parentText: string, subTaskText: string): Promise<boolean> {
        if (!isUsableSearchText(parentText)) return Promise.resolve(false);
        return this.edit(lines => {
            const index = lines.findIndex(line => line.includes(parentText));
            if (index === -1) return false;
            const indent = lines[index].match(/^(\s*)/)?.[1] ?? "";
            lines.splice(index + 1, 0, `${indent}  - ${TODO_CONSTANTS.MARKERS.PENDING} ${subTaskText}`);
            return true;
        });
    }

    /** Apply one edit under the file lock; the file is rewritten only when the edit applied. */
    private edit(apply: (lines: string[]) => boolean): Promise<boolean> {
        const run = this.lock.then(() => {
            const content = fs.existsSync(this.todoPath) ? fs.readFileSync(this.todoPath, "utf8") : "";
            const lines = content.split("\n");
            if (!apply(lines)) return false;
            atomicWrite(this.todoPath, lines.join("\n"));
            return true;
        });
        this.lock = run.catch(() => undefined);
        return run;
    }
}
