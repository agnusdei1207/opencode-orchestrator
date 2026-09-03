import { describe, it, expect, vi, beforeEach } from "vitest";
import { StateBroadcaster, stateBroadcaster, type MissionState } from "../../src/core/progress/state-broadcaster.js";
import { ProgressNotifier, progressNotifier } from "../../src/core/progress/progress-notifier.js";
import { TASK_STATUS } from "../../src/shared/index.js";

describe("StateBroadcaster & ProgressNotifier", () => {
    beforeEach(() => {
        StateBroadcaster._resetForTesting();
    });

    describe("StateBroadcaster", () => {
        it("broadcasts state to subscribers and unregisters on unsubscribe", () => {
            const broadcaster = StateBroadcaster.getInstance();
            const listener = vi.fn();

            const unsubscribe = broadcaster.subscribe(listener);

            const mockState: MissionState = {
                missionId: "m1",
                status: "executing",
                progress: { totalTasks: 10, completedTasks: 5, percentage: 50 },
                activeAgents: [],
                todo: [],
                lastUpdated: new Date(),
            };

            broadcaster.broadcast(mockState);
            expect(listener).toHaveBeenCalledWith(mockState);
            expect(broadcaster.getCurrentState()).toBe(mockState);

            unsubscribe();
            broadcaster.broadcast({ ...mockState, status: "completed" });
            expect(listener).toHaveBeenCalledTimes(1); // not called again
        });

        it("immediately delivers currentState to newly subscribing listeners", () => {
            const broadcaster = StateBroadcaster.getInstance();
            const mockState: MissionState = {
                missionId: "m1",
                status: "planning",
                progress: { totalTasks: 2, completedTasks: 0, percentage: 0 },
                activeAgents: [],
                todo: [],
                lastUpdated: new Date(),
            };

            broadcaster.broadcast(mockState);

            const lateListener = vi.fn();
            broadcaster.subscribe(lateListener);
            expect(lateListener).toHaveBeenCalledWith(mockState);
        });

        it("catches listener errors during broadcast without affecting other listeners", () => {
            const broadcaster = StateBroadcaster.getInstance();
            const badListener = vi.fn().mockImplementation(() => {
                throw new Error("listener failure");
            });
            const goodListener = vi.fn();

            broadcaster.subscribe(badListener);
            broadcaster.subscribe(goodListener);

            const mockState: MissionState = {
                missionId: "m1",
                status: "executing",
                progress: { totalTasks: 1, completedTasks: 1, percentage: 100 },
                activeAgents: [],
                todo: [],
                lastUpdated: new Date(),
            };

            expect(() => broadcaster.broadcast(mockState)).not.toThrow();
            expect(goodListener).toHaveBeenCalledWith(mockState);
        });
    });

    describe("ProgressNotifier", () => {
        it("polls and broadcasts status from manager", () => {
            const notifier = ProgressNotifier.getInstance();
            const mockManager = {
                getAllTasks: vi.fn().mockReturnValue([
                    { id: "t1", status: TASK_STATUS.RUNNING, agent: "worker", description: "Work" },
                    { id: "t2", status: TASK_STATUS.COMPLETED, agent: "reviewer", description: "Review" },
                ]),
            };

            notifier.setManager(mockManager as any);

            const listener = vi.fn();
            const unsub = stateBroadcaster.subscribe(listener);

            notifier.update();

            expect(mockManager.getAllTasks).toHaveBeenCalled();
            expect(listener).toHaveBeenCalled();
            const lastState = stateBroadcaster.getCurrentState();
            expect(lastState?.progress.totalTasks).toBe(2);
            expect(lastState?.progress.completedTasks).toBe(1);
            expect(lastState?.progress.percentage).toBe(50);
            expect(lastState?.activeAgents).toHaveLength(1);

            unsub();
        });

        it("handles update gracefully when manager is not set", () => {
            const notifier = ProgressNotifier.getInstance();
            notifier.setManager(null as any);
            expect(() => notifier.update()).not.toThrow();
        });
    });
});
