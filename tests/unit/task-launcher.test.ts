/**
 * Task Launcher Unit Tests
 * 
 * Verifies:
 * - Single task launch
 * - Batch task launch (parallel session creation)
 * - Concurrency acquisition logic
 * - Task status transitions (PENDING -> RUNNING)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskLauncher } from "../../src/core/agents/manager/task-launcher";
import { TaskStore } from "../../src/core/agents/task-store";
import { ConcurrencyController } from "../../src/core/agents/concurrency";
import { TASK_STATUS } from "../../src/shared";

// Mock crypto.randomUUID
if (!global.crypto) {
    (global as any).crypto = {
        randomUUID: () => "mock-uuid-1234-5678-9012"
    };
}

describe("TaskLauncher", () => {
    let mockClient: any;
    let store: TaskStore;
    let concurrency: ConcurrencyController;
    let sessionPool: any;
    let launcher: TaskLauncher;
    let startPolling: any;
    let onTaskError: any;

    beforeEach(() => {
        mockClient = {
            session: {
                create: vi.fn().mockResolvedValue({ data: { id: "new-session-id" } }),
                prompt: vi.fn().mockResolvedValue({}),
            }
        };
        store = new TaskStore();
        concurrency = new ConcurrencyController({ defaultConcurrency: 2 });

        // Mock acquire to be truly async so we can catch the PENDING state
        const originalAcquire = concurrency.acquire.bind(concurrency);
        vi.spyOn(concurrency, "acquire").mockImplementation(async (key) => {
            await new Promise(resolve => setTimeout(resolve, 10)); // Force delay
            return originalAcquire(key);
        });

        startPolling = vi.fn();
        onTaskError = vi.fn();

        sessionPool = {
            acquire: vi.fn().mockImplementation(async (agentName, parentID, description) => {
                const result = await mockClient.session.create({ body: { parentID, title: description } });
                return { id: result.data.id, agentName };
            }),
            release: vi.fn().mockResolvedValue(undefined),
        };

        launcher = new TaskLauncher(
            mockClient,
            "/test/dir",
            store,
            concurrency,
            sessionPool,
            onTaskError,
            startPolling
        );
    });

    it("should prepare a task correctly in PENDING status", async () => {
        const input = {
            description: "Test task",
            prompt: "Test prompt",
            agent: "builder",
            parentSessionID: "parent-123",
        };

        const result = await launcher.launch(input);
        const task = Array.isArray(result) ? result[0] : result;

        expect(task.status).toBe(TASK_STATUS.PENDING);
        expect(task.sessionID).toBe("new-session-id");
        expect(store.get(task.id)).toBeDefined();
        expect(store.getPendingCount("parent-123")).toBe(1);
        expect(startPolling).toHaveBeenCalled();
    });

    it("should execute tasks background and transition to RUNNING", async () => {
        const input = {
            description: "Background task",
            prompt: "Prompt",
            agent: "builder",
            parentSessionID: "p-1",
        };

        await launcher.launch(input);

        // Wait enough time for the background execution to pick up the slot
        // 50ms is enough for our 10ms delayed mock
        await new Promise(resolve => setTimeout(resolve, 50));

        const tasks = store.getAll();
        expect(tasks[0].status).toBe(TASK_STATUS.RUNNING);
        expect(mockClient.session.prompt).toHaveBeenCalledWith(expect.objectContaining({
            path: { id: "new-session-id" }
        }));
    });

    it("should handle batch launches in parallel", async () => {
        const inputs = [
            { description: "Task 1", prompt: "P1", agent: "builder", parentSessionID: "p-1" },
            { description: "Task 2", prompt: "P2", agent: "builder", parentSessionID: "p-1" },
            { description: "Task 3", prompt: "P3", agent: "builder", parentSessionID: "p-1" },
        ];

        // Ensure each create takes some time but happens in parallel
        let callCount = 0;
        mockClient.session.create.mockImplementation(async () => {
            callCount++;
            await new Promise(r => setTimeout(r, 10));
            return { data: { id: `session-${callCount}` } };
        });

        const startTime = Date.now();
        const results = await launcher.launch(inputs) as any[];
        const duration = Date.now() - startTime;

        expect(results).toHaveLength(3);
        // If they were sequential, total time > 30ms. If parallel, around 10-20ms.
        // (Note: In a mock environment this is subtle but helps verify the design).
        expect(duration).toBeLessThan(30);

        expect(results[0].status).toBe(TASK_STATUS.PENDING);
        expect(results[1].status).toBe(TASK_STATUS.PENDING);
        expect(results[2].status).toBe(TASK_STATUS.PENDING);
    });

    it("should respect concurrency limits in background", async () => {
        // Limit is 1
        concurrency = new ConcurrencyController({ defaultConcurrency: 1 });
        launcher = new TaskLauncher(mockClient, "/dir", store, concurrency, sessionPool, onTaskError, startPolling);

        const inputs = [
            { description: "T1", prompt: "P1", agent: "a", parentSessionID: "p" },
            { description: "T2", prompt: "P2", agent: "a", parentSessionID: "p" },
        ];

        await launcher.launch(inputs);
        await new Promise(resolve => setTimeout(resolve, 50));

        const tasks = store.getAll();
        const running = tasks.filter(t => t.status === TASK_STATUS.RUNNING);
        const pending = tasks.filter(t => t.status === TASK_STATUS.PENDING);

        expect(running).toHaveLength(1);
        expect(pending).toHaveLength(1);
    });
});
