import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as StrictReview from "../../src/core/review/strict-review";
import { ParallelAgentManager } from "../../src/core/agents/manager";
import { isSessionBusy } from "../../src/core/session/activity";
import { TASK_STATUS } from "../../src/shared";
import type { ParallelTask } from "../../src/shared";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));
vi.mock("../../src/core/session/activity", () => ({
    isSessionBusy: vi.fn(async () => false),
}));
vi.mock("../../src/core/recovery/session-recovery", () => ({
    isSessionRecovering: vi.fn(() => false),
}));
vi.mock("../../src/core/loop/circuit-breaker", () => ({
    isCircuitOpen: vi.fn(() => false),
}));

const tasks: ParallelTask[] = [];
const results = new Map<string, string>();
const manager = {
    getTaskBySession: vi.fn((sessionID: string) => tasks.find(task => task.sessionID === sessionID)),
    getTasksByParent: vi.fn((parent: string) => tasks.filter(task => task.parentSessionID === parent)),
    getResult: vi.fn(async (taskID: string) => results.get(taskID) ?? null),
};
vi.mock("../../src/core/agents/manager", () => ({
    ParallelAgentManager: { getInstance: vi.fn(() => manager) },
}));

const ROOT = "ses_commander";
let taskCounter = 0;

function addTask(partial: Partial<ParallelTask> & { agent: string }): ParallelTask {
    taskCounter += 1;
    const task = {
        id: `task_${taskCounter}`,
        sessionID: `ses_child_${taskCounter}`,
        parentSessionID: ROOT,
        description: "d",
        prompt: "p",
        status: TASK_STATUS.COMPLETED,
        startedAt: new Date(),
        completedAt: new Date(),
        depth: 1,
        ...partial,
    } as ParallelTask;
    tasks.push(task);
    return task;
}

function addReview(text: string, startedAt: number, status: string = TASK_STATUS.COMPLETED): ParallelTask {
    const task = addTask({
        agent: "Reviewer",
        status: status as ParallelTask["status"],
        startedAt: new Date(startedAt),
        completedAt: new Date(startedAt + 1),
    });
    results.set(task.id, text);
    return task;
}

function createClient() {
    const prompts: string[] = [];
    const client = {
        session: {
            prompt: vi.fn(async (request: { body: { parts: Array<{ text: string; synthetic?: boolean }> } }) => {
                prompts.push(request.body.parts.map(part => part.text).join("\n"));
                return { data: {} };
            }),
        },
    };
    return { client: client as unknown as Parameters<typeof StrictReview.handleStrictReviewIdle>[0], prompts };
}

function enable(maxReviewRejections = 3): void {
    StrictReview.configureStrictReview({ enabled: true, maxReviewRejections });
    StrictReview.rememberSessionAgent(ROOT, "Commander");
}

describe("strict review gate", () => {
    beforeEach(() => {
        StrictReview.resetStrictReview();
        tasks.length = 0;
        results.clear();
        taskCounter = 0;
        vi.mocked(isSessionBusy).mockResolvedValue(false);
        vi.mocked(ParallelAgentManager.getInstance).mockReturnValue(manager as unknown as ParallelAgentManager);
    });

    afterEach(() => {
        StrictReview.resetStrictReview();
    });

    describe("disabled (default)", () => {
        it("records nothing, blocks nothing and never prompts", async () => {
            StrictReview.rememberSessionAgent(ROOT, "Commander");
            StrictReview.recordToolChange(ROOT, "write", { filePath: "src/a.ts" });
            const { client, prompts } = createClient();

            expect(StrictReview.isTracking(ROOT)).toBe(false);
            expect(StrictReview.checkToolAllowed(ROOT, "task")).toBeUndefined();
            expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("proceed");
            expect(StrictReview.strictReviewSystemAddition(ROOT, "commander")).toBeUndefined();
            expect(prompts).toEqual([]);
        });
    });

    it("proceeds when the Commander session changed nothing", async () => {
        enable();
        StrictReview.recordToolChange(ROOT, "read", { filePath: "src/a.ts" });
        const { client, prompts } = createClient();

        expect(StrictReview.isTracking(ROOT)).toBe(false);
        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("proceed");
        expect(prompts).toEqual([]);
    });

    it("asks for an independent review when files changed and no verdict exists", async () => {
        enable();
        StrictReview.recordToolChange(ROOT, "edit", { filePath: "src/a.ts" });
        const { client, prompts } = createClient();

        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("handled");
        expect(prompts).toHaveLength(1);
        expect(prompts[0]).toContain(StrictReview.STRICT_REVIEW_MARKER);
        expect(prompts[0]).toContain("- src/a.ts");
        expect(prompts[0]).toContain('agent: "Reviewer"');
    });

    it("proceeds once a review started after the last change returns APPROVED", async () => {
        enable();
        StrictReview.recordToolChange(ROOT, "edit", { filePath: "src/a.ts" }, 1_000);
        addReview("Looks correct.\nVERDICT: APPROVED", 2_000);
        const { client, prompts } = createClient();

        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("proceed");
        expect(prompts).toEqual([]);
    });

    it("sends the findings back to Commander when the current review is REJECTED", async () => {
        enable();
        StrictReview.recordToolChange(ROOT, "edit", { filePath: "src/a.ts" }, 1_000);
        addReview("VERDICT: REJECTED\n- src/a.ts:12 — off-by-one in the loop bound", 2_000);
        const { client, prompts } = createClient();

        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("handled");
        expect(prompts[0]).toContain("REJECTED");
        expect(prompts[0]).toContain("src/a.ts:12 — off-by-one in the loop bound");
    });

    it("requires a new review when files change after an approval", async () => {
        enable();
        StrictReview.recordToolChange(ROOT, "edit", { filePath: "src/a.ts" }, 1_000);
        addReview("VERDICT: APPROVED", 2_000);
        const { client, prompts } = createClient();
        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("proceed");

        StrictReview.recordToolChange(ROOT, "write", { filePath: "src/b.ts" }, 3_000);

        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("handled");
        expect(prompts).toHaveLength(1);
        expect(prompts[0]).toContain("- src/b.ts");
        expect(prompts[0]).not.toContain("- src/a.ts");
    });

    it("ignores a review that started before the latest change", async () => {
        enable();
        addReview("VERDICT: APPROVED", 1_000);
        StrictReview.recordToolChange(ROOT, "edit", { filePath: "src/a.ts" }, 2_000);
        const { client, prompts } = createClient();

        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("handled");
        expect(prompts[0]).toContain("No Reviewer task has reviewed the latest changes");
    });

    it.each([
        ["no verdict line", "All good, ship it."],
        ["misspelled verdict", "VERDICT: APROVED"],
        ["verdict in a sentence", "I would give this VERDICT: APPROVED if tests passed."],
    ])("treats a %s as not approved", async (_label, text) => {
        enable();
        StrictReview.recordToolChange(ROOT, "edit", { filePath: "src/a.ts" }, 1_000);
        addReview(text, 2_000);
        const { client, prompts } = createClient();

        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("handled");
        expect(prompts[0]).toContain("no valid `VERDICT: APPROVED` or `VERDICT: REJECTED` line");
    });

    it("does not count a failed Reviewer task as a review", async () => {
        enable();
        StrictReview.recordToolChange(ROOT, "edit", { filePath: "src/a.ts" }, 1_000);
        addReview("VERDICT: APPROVED", 2_000, TASK_STATUS.ERROR);
        const { client, prompts } = createClient();

        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("handled");
        expect(prompts[0]).toContain("failed or was cancelled");
    });

    it("attributes Worker edits in a delegated child session to the Commander session", async () => {
        enable();
        const worker = addTask({ agent: "Worker", status: TASK_STATUS.COMPLETED });
        StrictReview.recordToolChange(worker.sessionID, "write", { filePath: "src/worker.ts" });
        const { client, prompts } = createClient();

        expect(StrictReview.isTracking(ROOT)).toBe(true);
        expect(StrictReview.isTracking(worker.sessionID)).toBe(false);
        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("handled");
        expect(prompts[0]).toContain("- src/worker.ts");
    });

    it("waits without prompting while delegated work is still running", async () => {
        enable();
        StrictReview.recordToolChange(ROOT, "edit", { filePath: "src/a.ts" });
        addTask({ agent: "Reviewer", status: TASK_STATUS.RUNNING });
        const { client, prompts } = createClient();

        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("handled");
        expect(prompts).toEqual([]);
    });

    it("does not prompt a session that is busy", async () => {
        enable();
        StrictReview.recordToolChange(ROOT, "edit", { filePath: "src/a.ts" });
        vi.mocked(isSessionBusy).mockResolvedValue(true);
        const { client, prompts } = createClient();

        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("handled");
        expect(prompts).toEqual([]);
    });

    it("escalates to the user after maxReviewRejections consecutive rejections and then stops", async () => {
        enable(2);
        const { client, prompts } = createClient();
        let clock = 1_000;

        StrictReview.recordToolChange(ROOT, "edit", { filePath: "src/a.ts" }, clock);
        addReview("VERDICT: REJECTED\n- first", clock += 1_000);
        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("handled");
        expect(prompts.at(-1)).toContain("consecutive rejection 1");

        StrictReview.recordToolChange(ROOT, "edit", { filePath: "src/a.ts" }, clock += 1_000);
        addReview("VERDICT: REJECTED\n- second", clock += 1_000);
        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("handled");
        expect(prompts.at(-1)).toContain("Automatic review stopped");
        expect(prompts.at(-1)).toContain("NOT approved");

        const count = prompts.length;
        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("handled");
        expect(prompts).toHaveLength(count);
    });

    it("lifts an escalation and resets the counters on a real user message", async () => {
        enable(1);
        StrictReview.recordToolChange(ROOT, "edit", { filePath: "src/a.ts" }, 1_000);
        addReview("VERDICT: REJECTED\n- bug", 2_000);
        const { client, prompts } = createClient();
        await StrictReview.handleStrictReviewIdle(client, ROOT);
        expect(prompts.at(-1)).toContain("Automatic review stopped");

        StrictReview.handleUserMessage(ROOT);
        StrictReview.recordToolChange(ROOT, "edit", { filePath: "src/a.ts" }, 3_000);

        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("handled");
        expect(prompts.at(-1)).toContain("Independent review required");
    });

    it("escalates when review is requested repeatedly with no verdict and no progress", async () => {
        enable();
        StrictReview.recordToolChange(ROOT, "edit", { filePath: "src/a.ts" });
        const { client, prompts } = createClient();

        for (let i = 0; i < 3; i++) await StrictReview.handleStrictReviewIdle(client, ROOT);
        expect(prompts.every(text => text.includes("Independent review required"))).toBe(true);

        await StrictReview.handleStrictReviewIdle(client, ROOT);
        expect(prompts.at(-1)).toContain("Automatic review stopped");
    });

    it("stays silent after a user abort until the user speaks again", async () => {
        enable();
        StrictReview.recordToolChange(ROOT, "edit", { filePath: "src/a.ts" });
        StrictReview.handleAbort(ROOT);
        const { client, prompts } = createClient();

        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("handled");
        expect(prompts).toEqual([]);

        StrictReview.handleUserMessage(ROOT);
        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("handled");
        expect(prompts).toHaveLength(1);
    });

    it("does not gate sessions that are not Commander", async () => {
        StrictReview.configureStrictReview({ enabled: true });
        StrictReview.rememberSessionAgent(ROOT, "build");
        StrictReview.recordToolChange(ROOT, "edit", { filePath: "src/a.ts" });
        const { client, prompts } = createClient();

        expect(StrictReview.isTracking(ROOT)).toBe(false);
        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("proceed");
        expect(prompts).toEqual([]);
    });

    it("ignores dry runs and still counts write tools that report no path", () => {
        enable();
        StrictReview.recordToolChange(ROOT, "sed_replace", { directory: "src", dry_run: true });
        expect(StrictReview.isTracking(ROOT)).toBe(false);

        StrictReview.recordToolChange(ROOT, "apply_patch", {});
        expect(StrictReview.isTracking(ROOT)).toBe(true);
    });

    it("does not invalidate an approval when only orchestrator bookkeeping files change", async () => {
        enable();
        StrictReview.recordToolChange(ROOT, "edit", { filePath: "src/a.ts" }, 1_000);
        addReview("VERDICT: APPROVED", 2_000);
        const { client, prompts } = createClient();
        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("proceed");

        StrictReview.recordToolChange(ROOT, "edit", { filePath: "/repo/.opencode/todo.md" }, 3_000);
        StrictReview.recordToolChange(ROOT, "write", { filePath: ".opencode\\verification-checklist.md" }, 3_001);
        StrictReview.recordToolChange(ROOT, "write", { filePath: ".opencode/docs/brain/scratchpad.md" }, 3_002);

        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("proceed");
        expect(prompts).toEqual([]);

        StrictReview.recordToolChange(ROOT, "write", { filePath: ".opencode/plugins/custom.ts" }, 4_000);
        expect(await StrictReview.handleStrictReviewIdle(client, ROOT)).toBe("handled");
    });

    describe("mechanical tool guards", () => {
        it("lets the Reviewer record verified bookkeeping items but nothing else", () => {
            enable();
            const reviewer = addTask({ agent: "Reviewer", status: TASK_STATUS.RUNNING });

            expect(StrictReview.checkToolAllowed(reviewer.sessionID, "edit", { filePath: ".opencode/todo.md" })).toBeUndefined();
            expect(StrictReview.checkToolAllowed(reviewer.sessionID, "edit", { filePath: "src/a.ts" })).toContain("read-only");
            expect(StrictReview.checkToolAllowed(reviewer.sessionID, "edit", {
                files: [".opencode/todo.md", "src/a.ts"],
            })).toContain("read-only");
        });

        it("keeps the Reviewer read-only", () => {
            enable();
            const reviewer = addTask({ agent: "Reviewer", status: TASK_STATUS.RUNNING });

            expect(StrictReview.checkToolAllowed(reviewer.sessionID, "edit")).toContain("read-only");
            expect(StrictReview.checkToolAllowed(reviewer.sessionID, "write")).toContain("read-only");
            expect(StrictReview.checkToolAllowed(reviewer.sessionID, "bash")).toBeUndefined();
            expect(StrictReview.checkToolAllowed(reviewer.sessionID, "read")).toBeUndefined();
        });

        it("routes Commander delegation through delegate_task", () => {
            enable();
            expect(StrictReview.checkToolAllowed(ROOT, "task")).toContain("delegate_task");
            expect(StrictReview.checkToolAllowed(ROOT, "subagent")).toContain("delegate_task");
            expect(StrictReview.checkToolAllowed(ROOT, "delegate_task")).toBeUndefined();
            expect(StrictReview.checkToolAllowed(ROOT, "edit")).toBeUndefined();
        });
    });

    describe("parseReviewVerdict", () => {
        it("uses the last verdict line and returns the findings after it", () => {
            expect(StrictReview.parseReviewVerdict("VERDICT: APPROVED\nlater...\nVERDICT: REJECTED\n- a.ts:1 — x")).toEqual({
                verdict: "rejected",
                findings: "- a.ts:1 — x",
            });
        });

        it("accepts light markdown decoration on the verdict line", () => {
            expect(StrictReview.parseReviewVerdict("**VERDICT: APPROVED**")?.verdict).toBe("approved");
            expect(StrictReview.parseReviewVerdict("> verdict: rejected")?.verdict).toBe("rejected");
        });

        it("returns undefined without a verdict line", () => {
            expect(StrictReview.parseReviewVerdict("Looks fine to me.")).toBeUndefined();
        });
    });

    describe("prompts and instructions", () => {
        it("marks gate prompts so they are not mistaken for user input", () => {
            expect(StrictReview.isStrictReviewPrompt(`${StrictReview.STRICT_REVIEW_MARKER} do X`)).toBe(true);
            expect(StrictReview.isStrictReviewPrompt("please fix the bug")).toBe(false);
        });

        it("adds role-specific system instructions only for Commander and Reviewer", () => {
            enable();
            expect(StrictReview.strictReviewSystemAddition(ROOT, undefined)).toContain("VERDICT: APPROVED");
            expect(StrictReview.strictReviewSystemAddition("x", "reviewer")).toContain("read-only");
            expect(StrictReview.strictReviewSystemAddition("x", "worker")).toBeUndefined();
        });
    });
});
