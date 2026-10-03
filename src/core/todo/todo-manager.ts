/**
 * TodoManager - MVCC-based Optimistic Locking with Mutex for TODO Synchronization
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { PATHS, TODO_CONSTANTS } from "../../shared/index.js";
import { log } from "../agents/logger.js";

interface TodoVersion {
    version: number;
    timestamp: number;
    author: string;
}

export interface TodoData {
    content: string;
    version: TodoVersion;
}

type TodoUpdateResult = { success: boolean; currentVersion: number; conflict?: boolean };

/** Temp files written but not yet renamed into place during one update attempt. */
interface PendingTempFiles {
    todoTmpPath?: string;
    versionTmpPath?: string;
}

export class TodoManager {
    private static _instance: TodoManager;
    private directory: string = "";
    private todoPath: string = "";
    private versionPath: string = "";
    private updateMutex: Promise<void> = Promise.resolve();

    private constructor() { }

    public static getInstance(directory?: string): TodoManager {
        if (!TodoManager._instance) {
            TodoManager._instance = new TodoManager();
        }
        if (directory) {
            TodoManager._instance.setDirectory(directory);
        }
        return TodoManager._instance;
    }

    public setDirectory(dir: string): void {
        this.directory = dir;
        this.todoPath = path.join(this.directory, PATHS.TODO);
        this.versionPath = path.join(this.directory, ".opencode/todo.version.json");
        const todoDir = path.dirname(this.todoPath);
        if (!fs.existsSync(todoDir)) {
            fs.mkdirSync(todoDir, { recursive: true });
        }
    }

    public async readWithVersion(): Promise<TodoData> {
        if (!this.directory) throw new Error("Directory not set");

        try {
            const content = fs.existsSync(this.todoPath)
                ? await fs.promises.readFile(this.todoPath, "utf-8")
                : "";

            let versionInfo: TodoVersion = {
                version: 0,
                timestamp: Date.now(),
                author: "system"
            };

            if (fs.existsSync(this.versionPath)) {
                try {
                    const data = await fs.promises.readFile(this.versionPath, "utf-8");
                    versionInfo = JSON.parse(data);
                } catch (e) {
                    log(`[TodoManager] Failed to parse version file: ${e}`);
                }
            }

            return { content, version: versionInfo };
        } catch (error) {
            log(`[TodoManager] Error reading TODO: ${error}`);
            return { content: "", version: { version: 0, timestamp: Date.now(), author: "system" } };
        }
    }

    /**
     * Update TODO with both MVCC (for logical consistency) and Mutex (for atomicity)
     */
    public async update(
        expectedVersion: number,
        updater: (content: string) => string,
        author: string
    ): Promise<{ success: boolean; currentVersion: number; conflict?: boolean }> {
        // Use a mutex to ensure only one update runs at a time within this process
        return new Promise((resolve, reject) => {
            this.updateMutex = this.updateMutex.then(async () => {
                try {
                    const result = await this._internalUpdate(expectedVersion, updater, author);
                    resolve(result);
                } catch (e) {
                    reject(e);
                }
            }).catch(e => {
                log(`[TodoManager] Mutex error: ${e}`);
                // Don't let the chain break
            });
        });
    }

    private async _internalUpdate(
        expectedVersion: number,
        updater: (content: string) => string,
        author: string
    ): Promise<TodoUpdateResult> {
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 50;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const temp: PendingTempFiles = {};
            try {
                return await this.attemptUpdate(expectedVersion, updater, author, temp);
            } catch (error) {
                await cleanupTempFile(temp.todoTmpPath);
                await cleanupTempFile(temp.versionTmpPath);
                if (attempt === MAX_RETRIES - 1) throw error;
                await new Promise(r => setTimeout(r, RETRY_DELAY));
            }
        }
        throw new Error("Failed to update TODO");
    }

    private async attemptUpdate(
        expectedVersion: number,
        updater: (content: string) => string,
        author: string,
        temp: PendingTempFiles
    ): Promise<TodoUpdateResult> {
        const current = await this.readWithVersion();

        if (current.version.version !== expectedVersion) {
            log(`[TodoManager] Conflict: expected v${expectedVersion}, found v${current.version.version}`);
            return {
                success: false,
                currentVersion: current.version.version,
                conflict: true
            };
        }

        const newContent = updater(current.content);
        if (newContent === current.content) {
            return {
                success: false,
                currentVersion: current.version.version
            };
        }

        const newVersion = current.version.version + 1;
        await this.writeVersionedContent(newContent, newVersion, author, temp);

        log(`[TodoManager] Updated TODO to v${newVersion} by ${author}`);
        return { success: true, currentVersion: newVersion };
    }

    /**
     * Write content then version via temp-file renames. `temp` tracks any temp
     * file not yet renamed so the caller can remove it if a write fails.
     */
    private async writeVersionedContent(
        newContent: string,
        newVersion: number,
        author: string,
        temp: PendingTempFiles
    ): Promise<void> {
        const tmpSuffix = `${Date.now()}.${randomUUID()}`;
        const tmpPath = `${this.todoPath}.tmp.${tmpSuffix}`;
        const versionTmpPath = `${this.versionPath}.tmp.${tmpSuffix}`;
        temp.todoTmpPath = tmpPath;
        temp.versionTmpPath = versionTmpPath;

        await fs.promises.writeFile(tmpPath, newContent, "utf-8");
        await fs.promises.rename(tmpPath, this.todoPath);
        temp.todoTmpPath = undefined;

        await fs.promises.writeFile(
            versionTmpPath,
            JSON.stringify({
                version: newVersion,
                timestamp: Date.now(),
                author
            }),
            "utf-8"
        );
        await fs.promises.rename(versionTmpPath, this.versionPath);
        temp.versionTmpPath = undefined;
    }

    public async updateItem(searchText: string, newStatus: string, author: string = "system"): Promise<boolean> {
        let retries = 5;
        while (retries-- > 0) {
            const data = await this.readWithVersion();
            const statusMap: Record<string, string> = {
                [TODO_CONSTANTS.STATUS.PENDING]: TODO_CONSTANTS.MARKERS.PENDING,
                [TODO_CONSTANTS.STATUS.COMPLETED]: TODO_CONSTANTS.MARKERS.COMPLETED,
                [TODO_CONSTANTS.STATUS.PROGRESS]: TODO_CONSTANTS.MARKERS.PROGRESS,
                [TODO_CONSTANTS.STATUS.FAILED]: TODO_CONSTANTS.MARKERS.FAILED,
            };
            const marker = statusMap[newStatus] || TODO_CONSTANTS.MARKERS.PENDING;

            const result = await this.update(data.version.version, (content) => {
                const lines = content.split("\n");
                let updated = false;
                const newLines = lines.map(line => {
                    if (line.includes(searchText) && /\[[ x\/\-]\]/.test(line)) {
                        updated = true;
                        return line.replace(/\[[ x\/\-]\]/, marker);
                    }
                    return line;
                });
                return updated ? newLines.join("\n") : content;
            }, author);

            if (result.success) return true;
            if (!result.conflict) return false;
            // On conflict, wait a bit and retry from while loop
            await new Promise(r => setTimeout(r, 50));
        }
        return false;
    }

    public async addSubTask(parentText: string, subTaskText: string, author: string = "system"): Promise<boolean> {
        let retries = 5;
        while (retries-- > 0) {
            const data = await this.readWithVersion();
            const result = await this.update(data.version.version, (content) => {
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
                    return lines.join("\n");
                }
                return content;
            }, author);

            if (result.success) return true;
            if (!result.conflict) return false;
            await new Promise(r => setTimeout(r, 50));
        }
        return false;
    }

}

async function cleanupTempFile(filePath: string | undefined): Promise<void> {
    if (!filePath) return;

    try {
        await fs.promises.rm(filePath, { force: true });
    } catch {
        // Best-effort cleanup only.
    }
}
