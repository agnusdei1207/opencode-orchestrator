/**
 * Multi-Agent Coordination E2E Tests
 * 
 * Tests the coordination patterns between:
 * - Commander (orchestrator)
 * - Planner (planning)
 * - Worker (implementation)
 * - Reviewer (verification)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../src/core/agents/logger", () => ({
    log: vi.fn(),
}));

import { TaskStore } from "../../src/core/agents/task-store";
import { ConcurrencyController } from "../../src/core/agents/concurrency";
import type { ParallelTask } from "../../src/core/agents/interfaces/parallel-task.interface";
import { TASK_STATUS, AGENT_NAMES } from "../../src/shared";

function createAgentTask(
    agent: string,
    parentSessionID: string,
    overrides: Partial<ParallelTask> = {}
): ParallelTask {
    return {
        id: `task_${agent}_${Math.random().toString(36).slice(2, 8)}`,
        sessionID: `session_${agent}_${Math.random().toString(36).slice(2, 8)}`,
        parentSessionID,
        description: `${agent} task`,
        prompt: `Execute ${agent} task`,
        agent,
        status: TASK_STATUS.RUNNING,
        startedAt: new Date(),
        concurrencyKey: agent,
        depth: agent === AGENT_NAMES.COMMANDER ? 0 : 1,
        ...overrides,
    };
}

describe("Multi-Agent Coordination E2E", () => {
    let store: TaskStore;
    let concurrency: ConcurrencyController;
    const mainSession = "main_session_123";

    beforeEach(() => {
        store = new TaskStore();
        concurrency = new ConcurrencyController({
            defaultConcurrency: 5,
            agentConcurrency: {
                [AGENT_NAMES.COMMANDER]: 1,
                [AGENT_NAMES.PLANNER]: 2,
                [AGENT_NAMES.WORKER]: 10,
                [AGENT_NAMES.REVIEWER]: 5,
            },
        });
    });

    // ========================================================================
    // Commander → Planner Delegation
    // ========================================================================

    describe("Commander → Planner delegation", () => {
        it("should delegate planning task from Commander to Planner", async () => {
            // Commander is the main session (no task created for it)
            const plannerTask = createAgentTask(AGENT_NAMES.PLANNER, mainSession);

            await concurrency.acquire(plannerTask.concurrencyKey!);
            store.set(plannerTask.id, plannerTask);
            store.trackPending(mainSession, plannerTask.id);

            expect(store.get(plannerTask.id)).toBeDefined();
            expect(store.get(plannerTask.id)?.agent).toBe(AGENT_NAMES.PLANNER);
            expect(concurrency.getActiveCount(AGENT_NAMES.PLANNER)).toBe(1);

            // Planner completes
            plannerTask.status = TASK_STATUS.COMPLETED;
            plannerTask.result = "Created TODO with 5 tasks";
            concurrency.release(plannerTask.concurrencyKey!);
            store.untrackPending(mainSession, plannerTask.id);

            expect(store.hasPending(mainSession)).toBe(false);
        });

        it("should limit Commander to single instance", async () => {
            const limit = concurrency.getConcurrencyLimit(AGENT_NAMES.COMMANDER);
            expect(limit).toBe(1);
        });
    });

    // ========================================================================
    // Parallel Worker Execution
    // ========================================================================

    describe("parallel Worker execution", () => {
        it("should execute multiple Workers in parallel", async () => {
            const workerCount = 5;
            const workers: ParallelTask[] = [];

            // Launch multiple workers
            for (let i = 0; i < workerCount; i++) {
                const worker = createAgentTask(AGENT_NAMES.WORKER, mainSession, {
                    id: `worker_${i}`,
                    description: `Worker task ${i}`,
                });
                await concurrency.acquire(worker.concurrencyKey!);
                store.set(worker.id, worker);
                store.trackPending(mainSession, worker.id);
                workers.push(worker);
            }

            expect(store.getPendingCount(mainSession)).toBe(workerCount);
            expect(concurrency.getActiveCount(AGENT_NAMES.WORKER)).toBe(workerCount);

            // Complete workers one by one
            for (const worker of workers) {
                worker.status = TASK_STATUS.COMPLETED;
                concurrency.release(worker.concurrencyKey!);
                store.untrackPending(mainSession, worker.id);
            }

            expect(store.getPendingCount(mainSession)).toBe(0);
            expect(concurrency.getActiveCount(AGENT_NAMES.WORKER)).toBe(0);
        });

        it("should respect Worker concurrency limits", async () => {
            const workerLimit = concurrency.getConcurrencyLimit(AGENT_NAMES.WORKER);
            expect(workerLimit).toBe(10);
        });
    });

    // ========================================================================
    // Worker → Reviewer Verification Pipeline
    // ========================================================================

    describe("Worker → Reviewer verification pipeline", () => {
        it("should trigger Reviewer after Worker completion", async () => {
            // Worker completes
            const worker = createAgentTask(AGENT_NAMES.WORKER, mainSession);
            await concurrency.acquire(worker.concurrencyKey!);
            store.set(worker.id, worker);
            store.trackPending(mainSession, worker.id);

            worker.status = TASK_STATUS.COMPLETED;
            worker.result = "Implemented feature X";
            concurrency.release(worker.concurrencyKey!);
            store.untrackPending(mainSession, worker.id);

            // Reviewer is triggered
            const reviewer = createAgentTask(AGENT_NAMES.REVIEWER, mainSession, {
                description: `Review ${worker.id}`,
            });
            await concurrency.acquire(reviewer.concurrencyKey!);
            store.set(reviewer.id, reviewer);
            store.trackPending(mainSession, reviewer.id);

            expect(store.get(reviewer.id)?.agent).toBe(AGENT_NAMES.REVIEWER);
            expect(concurrency.getActiveCount(AGENT_NAMES.REVIEWER)).toBe(1);

            // Reviewer completes
            reviewer.status = TASK_STATUS.COMPLETED;
            reviewer.result = "PASS - all tests green";
            concurrency.release(reviewer.concurrencyKey!);
            store.untrackPending(mainSession, reviewer.id);

            expect(store.hasPending(mainSession)).toBe(false);
        });

        it("should handle parallel Worker-Reviewer pairs", async () => {
            const pairCount = 3;
            const pairs: { worker: ParallelTask; reviewer: ParallelTask }[] = [];

            // Launch worker-reviewer pairs in parallel
            for (let i = 0; i < pairCount; i++) {
                const worker = createAgentTask(AGENT_NAMES.WORKER, mainSession, {
                    id: `worker_pair_${i}`,
                });
                const reviewer = createAgentTask(AGENT_NAMES.REVIEWER, mainSession, {
                    id: `reviewer_pair_${i}`,
                    description: `Review worker_pair_${i}`,
                });

                await concurrency.acquire(worker.concurrencyKey!);
                await concurrency.acquire(reviewer.concurrencyKey!);

                store.set(worker.id, worker);
                store.set(reviewer.id, reviewer);
                store.trackPending(mainSession, worker.id);
                store.trackPending(mainSession, reviewer.id);

                pairs.push({ worker, reviewer });
            }

            expect(store.getPendingCount(mainSession)).toBe(pairCount * 2);

            // Complete all pairs
            for (const { worker, reviewer } of pairs) {
                worker.status = TASK_STATUS.COMPLETED;
                reviewer.status = TASK_STATUS.COMPLETED;
                concurrency.release(worker.concurrencyKey!);
                concurrency.release(reviewer.concurrencyKey!);
                store.untrackPending(mainSession, worker.id);
                store.untrackPending(mainSession, reviewer.id);
            }

            expect(store.getPendingCount(mainSession)).toBe(0);
        });
    });

    // ========================================================================
    // Full HPFA Workflow
    // ========================================================================

    describe("full HPFA workflow", () => {
        it("should execute complete HPFA pipeline", async () => {
            // Phase 1: Commander starts, delegates to Planner
            const planner = createAgentTask(AGENT_NAMES.PLANNER, mainSession);
            await concurrency.acquire(planner.concurrencyKey!);
            store.set(planner.id, planner);
            store.trackPending(mainSession, planner.id);

            // Phase 2: Planner completes with TODO
            planner.status = TASK_STATUS.COMPLETED;
            planner.result = "TODO created: 3 worker tasks";
            concurrency.release(planner.concurrencyKey!);
            store.untrackPending(mainSession, planner.id);

            // Phase 3: Parallel Workers
            const workers: ParallelTask[] = [];
            for (let i = 0; i < 3; i++) {
                const worker = createAgentTask(AGENT_NAMES.WORKER, mainSession, {
                    id: `hpfa_worker_${i}`,
                });
                await concurrency.acquire(worker.concurrencyKey!);
                store.set(worker.id, worker);
                store.trackPending(mainSession, worker.id);
                workers.push(worker);
            }

            expect(store.getPendingCount(mainSession)).toBe(3);

            // Phase 4: Workers complete, Reviewers verify
            const reviewers: ParallelTask[] = [];
            for (const worker of workers) {
                worker.status = TASK_STATUS.COMPLETED;
                concurrency.release(worker.concurrencyKey!);
                store.untrackPending(mainSession, worker.id);

                const reviewer = createAgentTask(AGENT_NAMES.REVIEWER, mainSession, {
                    id: `hpfa_reviewer_${worker.id}`,
                });
                await concurrency.acquire(reviewer.concurrencyKey!);
                store.set(reviewer.id, reviewer);
                store.trackPending(mainSession, reviewer.id);
                reviewers.push(reviewer);
            }

            // Phase 5: All Reviewers complete
            for (const reviewer of reviewers) {
                reviewer.status = TASK_STATUS.COMPLETED;
                reviewer.result = "PASS";
                concurrency.release(reviewer.concurrencyKey!);
                store.untrackPending(mainSession, reviewer.id);
            }

            // Phase 6: All complete, ready for conclusion
            expect(store.getPendingCount(mainSession)).toBe(0);
            expect(concurrency.getActiveCount(AGENT_NAMES.WORKER)).toBe(0);
            expect(concurrency.getActiveCount(AGENT_NAMES.REVIEWER)).toBe(0);
        });
    });

    // ========================================================================
    // Error Handling in Coordination
    // ========================================================================

    describe("error handling in coordination", () => {
        it("should handle Worker failure gracefully", async () => {
            const worker = createAgentTask(AGENT_NAMES.WORKER, mainSession);
            await concurrency.acquire(worker.concurrencyKey!);
            store.set(worker.id, worker);
            store.trackPending(mainSession, worker.id);

            // Worker fails
            worker.status = TASK_STATUS.ERROR;
            worker.error = "Build failed";
            worker.completedAt = new Date();
            concurrency.release(worker.concurrencyKey!);
            store.untrackPending(mainSession, worker.id);
            store.queueNotification(worker);

            // Check notification queued
            const notifications = store.getNotifications(mainSession);
            expect(notifications).toHaveLength(1);
            expect(notifications[0].status).toBe(TASK_STATUS.ERROR);
        });

        it("should handle Reviewer rejection", async () => {
            const reviewer = createAgentTask(AGENT_NAMES.REVIEWER, mainSession);
            await concurrency.acquire(reviewer.concurrencyKey!);
            store.set(reviewer.id, reviewer);
            store.trackPending(mainSession, reviewer.id);

            // Reviewer rejects
            reviewer.status = TASK_STATUS.COMPLETED;
            reviewer.result = "FAIL - 3 issues found";
            concurrency.release(reviewer.concurrencyKey!);
            store.untrackPending(mainSession, reviewer.id);
            store.queueNotification(reviewer);

            const notifications = store.getNotifications(mainSession);
            expect(notifications[0].result).toContain("FAIL");
        });
    });

    // ========================================================================
    // Agent Type Statistics
    // ========================================================================

    describe("agent type statistics", () => {
        it("should track tasks by agent type", async () => {
            const agents = [
                AGENT_NAMES.PLANNER,
                AGENT_NAMES.WORKER,
                AGENT_NAMES.WORKER,
                AGENT_NAMES.REVIEWER,
            ];

            for (const agent of agents) {
                const task = createAgentTask(agent, mainSession);
                await concurrency.acquire(task.concurrencyKey!);
                store.set(task.id, task);
            }

            const allTasks = store.getAll();
            const byAgent = allTasks.reduce((acc, task) => {
                acc[task.agent] = (acc[task.agent] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            expect(byAgent[AGENT_NAMES.PLANNER]).toBe(1);
            expect(byAgent[AGENT_NAMES.WORKER]).toBe(2);
            expect(byAgent[AGENT_NAMES.REVIEWER]).toBe(1);
        });
    });
});
