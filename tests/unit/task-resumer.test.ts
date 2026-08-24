import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskResumer } from "../../src/core/agents/manager/task-resumer";
import { TaskStore } from "../../src/core/agents/task-store";
import { AgentRegistry } from "../../src/core/agents/agent-registry";
import { MemoryLevel, MemoryManager } from "../../src/core/memory/memory-manager";
import { AGENT_NAMES, TASK_STATUS, TOOL_NAMES, type ParallelTask } from "../../src/shared";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

type TaskResumerClient = ConstructorParameters<typeof TaskResumer>[0];

describe("TaskResumer", () => {
    let store: TaskStore;
    let mockClient: {
        session: {
            prompt: ReturnType<typeof vi.fn>;
            status: ReturnType<typeof vi.fn>;
        };
    };
    let notifyParentIfAllComplete: ReturnType<typeof vi.fn>;
    let startPolling: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        store = new TaskStore();
        mockClient = {
            session: {
                prompt: vi.fn().mockResolvedValue({}),
                status: vi.fn().mockResolvedValue({ data: {} }),
            },
        };
        notifyParentIfAllComplete = vi.fn().mockResolvedValue(undefined);
        startPolling = vi.fn();
        MemoryManager.getInstance().import({
            [MemoryLevel.SYSTEM]: [],
            [MemoryLevel.PROJECT]: [],
            [MemoryLevel.MISSION]: [],
            [MemoryLevel.TASK]: [],
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("routes custom-agent resumes through Commander with the custom role prompt and task tools", async () => {
        const customAgent = "CustomResumeAgent";
        AgentRegistry.getInstance().registerAgent(customAgent, {
            id: customAgent,
            description: "Custom resume specialist",
            systemPrompt: "CUSTOM RESUME SYSTEM",
            canWrite: true,
            canBash: true,
        });

        const task = createTask({ agent: customAgent });
        const resumer = new TaskResumer(
            mockClient as unknown as TaskResumerClient,
            store,
            (sessionID) => sessionID === task.sessionID ? task : undefined,
            startPolling,
            notifyParentIfAllComplete,
        );

        const result = await resumer.resume({
            sessionId: task.sessionID,
            prompt: "Continue custom work",
            parentSessionID: "parent-2",
        });

        expect(result).toBe(task);
        await vi.waitFor(() => expect(mockClient.session.prompt).toHaveBeenCalled());
        expect(mockClient.session.prompt).toHaveBeenCalledWith({
            path: { id: task.sessionID },
            body: expect.objectContaining({
                agent: AGENT_NAMES.COMMANDER,
                tools: expect.objectContaining({
                    [TOOL_NAMES.DELEGATE_TASK]: true,
                    [TOOL_NAMES.GET_TASK_RESULT]: true,
                    [TOOL_NAMES.RUN_COMMAND]: true,
                }),
                parts: [{
                    type: "text",
                    text: expect.stringContaining("### AGENT ROLE: CustomResumeAgent"),
                    synthetic: true,
                }],
            }),
        });
        const promptText = mockClient.session.prompt.mock.calls[0][0].body.parts[0].text;
        expect(promptText).toContain("CUSTOM RESUME SYSTEM");
        expect(promptText).toContain("Continue custom work");
        expect(mockClient.session.prompt.mock.calls[0][0].body.parts[0].synthetic).toBe(true);
    });

    it("refuses to resume a session that is still running", async () => {
        const task = createTask({ status: TASK_STATUS.COMPLETED });
        mockClient.session.status.mockResolvedValue({
            data: { [task.sessionID]: { type: "busy" } },
        });
        const resumer = new TaskResumer(
            mockClient as unknown as TaskResumerClient,
            store,
            (sessionID) => sessionID === task.sessionID ? task : undefined,
            startPolling,
            notifyParentIfAllComplete,
        );

        await expect(resumer.resume({
            sessionId: task.sessionID,
            prompt: "Continue custom work",
            parentSessionID: "parent-2",
        })).rejects.toThrow("still running");

        expect(mockClient.session.prompt).not.toHaveBeenCalled();
        expect(task.status).toBe(TASK_STATUS.COMPLETED);
        expect(startPolling).not.toHaveBeenCalled();
    });

    it("rechecks activity after prompt routing before writing to the session", async () => {
        const task = createTask({ status: TASK_STATUS.COMPLETED });
        let busy = false;
        mockClient.session.status.mockImplementation(async () => ({
            data: busy ? { [task.sessionID]: { type: "busy" } } : {},
        }));

        let releaseRouting!: () => void;
        let markRoutingStarted!: () => void;
        const routingGate = new Promise<void>((resolve) => { releaseRouting = resolve; });
        const routingStarted = new Promise<void>((resolve) => { markRoutingStarted = resolve; });
        vi.spyOn(AgentRegistry.getInstance(), "ready").mockImplementationOnce(() => {
            markRoutingStarted();
            return routingGate;
        });

        const resumer = new TaskResumer(
            mockClient as unknown as TaskResumerClient,
            store,
            (sessionID) => sessionID === task.sessionID ? task : undefined,
            startPolling,
            notifyParentIfAllComplete,
        );
        const resume = resumer.resume({
            sessionId: task.sessionID,
            prompt: "Continue custom work",
            parentSessionID: "parent-2",
        });

        await routingStarted;
        busy = true;
        releaseRouting();

        await expect(resume).rejects.toThrow("still running");
        expect(mockClient.session.prompt).not.toHaveBeenCalled();
        expect(task.status).toBe(TASK_STATUS.COMPLETED);
        expect(startPolling).not.toHaveBeenCalled();
    });
});

function createTask(overrides: Partial<ParallelTask> = {}): ParallelTask {
    return {
        id: "task-1",
        sessionID: "session-1",
        parentSessionID: "parent-1",
        description: "Task",
        prompt: "Initial prompt",
        agent: "Worker",
        status: TASK_STATUS.COMPLETED,
        startedAt: new Date(),
        depth: 1,
        reset: vi.fn(),
        ...overrides,
    };
}
