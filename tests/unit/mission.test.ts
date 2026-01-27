import { describe, it, expect, beforeEach, vi } from "vitest";
import { MissionController } from "../../src/core/mission/mission-controller.js";
import { AGENT_NAMES } from "../../src/shared/index.js";

describe("MissionController", () => {
    let controller: MissionController;
    let mockClient: any;

    beforeEach(() => {
        mockClient = {
            session: {
                create: vi.fn().mockResolvedValue({ data: { id: "sess_123" } }),
                prompt: vi.fn().mockResolvedValue({}),
                todo: vi.fn().mockResolvedValue({ data: [] }),
                status: vi.fn().mockResolvedValue({ data: { sess_123: { type: "idle" } } }),
            }
        };

        controller = new MissionController({ client: mockClient } as any);
    });

    it("should start a mission by creating a session and sending commander prompt", async () => {
        const sessionID = await controller.start("Find and fix bugs in the core");

        expect(sessionID).toBe("sess_123");
        expect(mockClient.session.create).toHaveBeenCalled();
        expect(mockClient.session.prompt).toHaveBeenCalledWith(expect.objectContaining({
            path: { id: "sess_123" },
            body: expect.objectContaining({
                agent: AGENT_NAMES.COMMANDER
            })
        }));
    });

    it("should handle iterations when session is idle", async () => {
        await controller.start("Test mission");

        // Mock todos: 1 pending
        mockClient.session.todo.mockResolvedValue({
            data: [{ id: "t1", content: "Do something", status: "pending", priority: "high" }]
        });

        const result = await controller.nextIteration();

        expect(result.continue).toBe(true);
        expect(mockClient.session.prompt).toHaveBeenCalledTimes(2); // Start + 1 iteration
    });

    it("should detect completion when all todos are finished", async () => {
        await controller.start("Test mission");

        // Mock todos: all completed
        mockClient.session.todo.mockResolvedValue({
            data: [{ id: "t1", content: "Done task", status: "completed", priority: "low" }]
        });

        const result = await controller.nextIteration();

        expect(result.continue).toBe(false);
        expect(result.reason).toBe("All todos completed");
    });

    it("should detect stagnation after matching todo hashes", async () => {
        await controller.start("Test mission");

        const pendingTodos = [{ id: "t1", content: "Stuck task", status: "pending", priority: "medium" }];
        mockClient.session.todo.mockResolvedValue({ data: pendingTodos });

        // First idle - hash recorded, stagnationCount = 0
        await controller.nextIteration();

        // Second idle - hash matches, stagnationCount = 1
        await controller.nextIteration();

        // Third idle - hash matches, stagnationCount = 2 -> Intervention!
        const result = await controller.nextIteration();

        expect(result.prompt).toContain("STRATEGY ALERT");
        expect(result.prompt).toContain("stagnated");
    });

    it("should not continue if session is busy", async () => {
        await controller.start("Test mission");

        // Mock session as busy
        mockClient.session.status.mockResolvedValue({ data: { sess_123: { type: "busy" } } });

        const result = await controller.nextIteration();

        expect(result.continue).toBe(true);
        expect(result.reason).toBe("Session still busy");
        expect(mockClient.session.prompt).toHaveBeenCalledTimes(1); // Only initial prompt
    });
});
