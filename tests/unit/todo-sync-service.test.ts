import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TodoSyncService } from "../../src/core/sync/todo-sync-service.js";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PATHS } from "../../src/shared/index.js";

describe("TodoSyncService", () => {
    let testDir: string;
    let mockClient: any;
    let service: TodoSyncService;

    beforeEach(() => {
        testDir = mkdtempSync(path.join(tmpdir(), "oco-todosync-test-"));
        mockClient = {};
        service = new TodoSyncService(mockClient, testDir);
    });

    afterEach(() => {
        service.stop();
        try {
            rmSync(testDir, { recursive: true, force: true });
        } catch {
            // ignore
        }
    });

    it("creates .opencode/todo.md if it does not exist and starts file watcher", async () => {
        await service.start();

        const todoPath = path.join(testDir, PATHS.TODO);
        expect(existsSync(todoPath)).toBe(true);

        // Can register and unregister sessions
        service.registerSession("session-1");
        service.registerSession("session-2");
        service.unregisterSession("session-1");
    });

    it("updates and removes task status in todoSync", async () => {
        await service.start();

        const taskItem = {
            id: "t1",
            description: "Task description",
            status: "running",
            agent: "worker",
            isBackground: true,
            parentSessionID: "parent-1",
        };

        service.registerSession("parent-1");
        service.updateTaskStatus(taskItem);

        // Update with no parent session
        service.updateTaskStatus({ ...taskItem, id: "t2", parentSessionID: undefined });

        // Remove task
        service.removeTask("t1");
        service.removeTask("t2");
        service.removeTask("nonexistent");
    });

    it("stops watcher and clears active sessions", async () => {
        await service.start();
        service.registerSession("s1");
        service.stop();

        expect((service as any).watcher).toBeNull();
        expect((service as any).activeSessions.size).toBe(0);
    });
});
