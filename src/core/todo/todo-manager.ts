/**
 * TodoManager - MVCC-based Optimistic Locking with Mutex for TODO Synchronization
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { PATHS, TODO_CONSTANTS } from "../../shared/index.js";
import { log } from "../agents/logger.js";

export interface TodoVersion {
    version: number;
    timestamp: number;
    author: string;
}

export interface TodoData {
    content: string;
    version: TodoVersion;
}

export class TodoManager {
    private static _instance: TodoManager;
    private directory: string = "";
    private todoPath: string = "";
    private versionPath: string = "";
    private historyPath: string = "";
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
        this.historyPath = path.join(this.directory, ".opencode/archive/todo_history.jsonl");

        const archiveDir = path.dirname(this.historyPath);
        if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
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
    ): Promise<{ success: boolean; currentVersion: number; conflict?: boolean }> {
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 50;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
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
                const newVersion = current.version.version + 1;
                const tmpPath = `${this.todoPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;

                await fs.promises.writeFile(tmpPath, newContent, "utf-8");
                await fs.promises.writeFile(
                    this.versionPath,
                    JSON.stringify({
                        version: newVersion,
                        timestamp: Date.now(),
                        author
                    }),
                    "utf-8"
                );

                await fs.promises.rename(tmpPath, this.todoPath);

                this.logChange(newVersion, newContent, author).catch(() => { });

                log(`[TodoManager] Updated TODO to v${newVersion} by ${author}`);
                return { success: true, currentVersion: newVersion };

            } catch (error) {
                if (attempt === MAX_RETRIES - 1) throw error;
                await new Promise(r => setTimeout(r, RETRY_DELAY));
            }
        }
        throw new Error("Failed to update TODO");
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

    private async logChange(version: number, content: string, author: string) {
        const entry = {
            version,
            timestamp: Date.now(),
            author,
            contentHash: crypto.createHash("sha256").update(content).digest("hex"),
            size: content.length
        };
        await fs.promises.appendFile(this.historyPath, JSON.stringify(entry) + "\n", "utf-8");
    }
}
