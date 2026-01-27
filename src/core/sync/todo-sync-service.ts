import * as fs from "node:fs";
import * as path from "node:path";
import type { PluginInput } from "@opencode-ai/plugin";
import {
  type Todo,
  TODO_STATUS,
  PATHS,
  TASK_STATUS,
  STATUS_LABEL,
  TODO_CONSTANTS,
} from "../../shared/index.js";
import { parseTodoMd } from "./todo-parser.js";
import { log } from "../agents/logger.js";

type OpencodeClient = PluginInput["client"];

interface TrackedTaskTodo {
  id: string;
  description: string;
  status: string;
  agent: string;
  isBackground: boolean;
  parentSessionID?: string;
}

export class TodoSyncService {
  private client: OpencodeClient;
  private directory: string;
  private todoPath: string;
  private fileTodos: Todo[] = [];
  private taskTodos: Map<string, TrackedTaskTodo> = new Map();
  private updateTimeout: NodeJS.Timeout | null = null;
  private watcher: fs.FSWatcher | null = null;
  private watcherDebounceTimer: NodeJS.Timeout | null = null;

  private activeSessions: Set<string> = new Set();

  constructor(client: OpencodeClient, directory: string) {
    this.client = client;
    this.directory = directory;
    this.todoPath = path.join(this.directory, PATHS.TODO);
  }

  async start() {
    // Initial sync
    await this.reloadFileTodos();

    // Ensure .opencode/todo.md exists (creates if not)
    this.ensureFileExists();

    // Watch for file changes
    if (fs.existsSync(this.todoPath)) {
      this.watcher = fs.watch(this.todoPath, (eventType) => {
        if (eventType === "change" || eventType === "rename") {
          if (this.watcherDebounceTimer) {
            clearTimeout(this.watcherDebounceTimer);
          }
          this.watcherDebounceTimer = setTimeout(() => {
            this.reloadFileTodos().catch((err) =>
              log(`[TodoSync] Error reloading: ${err}`),
            );
            this.watcherDebounceTimer = null;
          }, 500);
        }
      });

      // Handle watcher errors
      this.watcher.on("error", (err) => {
        log(`[TodoSync] Watcher error: ${err}`);
        this.stop();
      });

      log("[TodoSync] File watcher started");
    }
  }

  /**
   * Ensure .opencode/todo.md file exists
   */
  private ensureFileExists() {
    if (!fs.existsSync(this.todoPath)) {
      try {
        // Create minimal empty todo file
        const header = `# Mission Tasks\n\n## Task List\n\n[ ] *Start your mission by creating a task list\n\n`;
        fs.mkdirSync(path.dirname(this.todoPath), { recursive: true });
        fs.writeFileSync(this.todoPath, header, "utf-8");
        log("[TodoSync] Created .opencode/todo.md");
      } catch (error) {
        log(`[TodoSync] Failed to create todo.md: ${error}`);
      }
    }
  }

  registerSession(sessionID: string) {
    this.activeSessions.add(sessionID);
    // Push current state to new session
    this.scheduleUpdate(sessionID);
  }

  unregisterSession(sessionID: string) {
    this.activeSessions.delete(sessionID);
  }

  private async reloadFileTodos() {
    let fileHandle: fs.promises.FileHandle | null = null;
    try {
      if (fs.existsSync(this.todoPath)) {
        fileHandle = await fs.promises.open(this.todoPath, 'r');
        const content = await fileHandle.readFile('utf-8');
        this.fileTodos = parseTodoMd(content);
        this.broadcastUpdate();
      }
    } catch (error) {
      log(`[TodoSync] Failed to read todo.md: ${error}`);
    } finally {
      // GUARANTEED cleanup: Close file handle
      if (fileHandle) {
        await fileHandle.close().catch(() => {});
      }
    }
  }

  /**
   * Called by TaskToastManager when tasks change
   */
  updateTaskStatus(task: TrackedTaskTodo) {
    this.taskTodos.set(task.id, task);
    // Also update .opencode/todo.md file if it exists
    this.ensureFileExists();
    if (task.parentSessionID) {
      this.scheduleUpdate(task.parentSessionID);
    } else {
      this.broadcastUpdate();
    }
  }

  removeTask(taskId: string) {
    const task = this.taskTodos.get(taskId);
    if (task) {
      this.taskTodos.delete(taskId);
      if (task.parentSessionID) {
        this.scheduleUpdate(task.parentSessionID);
      } else {
        this.broadcastUpdate();
      }
    }
  }

  private broadcastUpdate() {
    for (const sessionID of this.activeSessions) {
      this.scheduleUpdate(sessionID);
    }
  }

  private scheduleUpdate(sessionID: string) {
    // Debounce updates per session (simplified for now)
    this.sendTodosToSession(sessionID).catch((err) => {
      // Ignore errors (session might be closed)
    });
  }

  private async sendTodosToSession(sessionID: string) {
    // Only read todos from session (API is read-only like oh-my-opencode)
    // OpenCode's TUI displays .opencode/todo.md file directly
    // This method is kept for potential future use
  }

  stop() {
    // Clean up file watcher
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      log("[TodoSync] File watcher closed");
    }

    // Clean up debounce timer
    if (this.watcherDebounceTimer) {
      clearTimeout(this.watcherDebounceTimer);
      this.watcherDebounceTimer = null;
    }

    // Clean up update timeout
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }

    // Clear sessions
    this.activeSessions.clear();
    log("[TodoSync] Stopped");
  }
}
