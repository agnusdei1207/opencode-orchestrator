import type { PluginInput } from "@opencode-ai/plugin";
import { AGENT_NAMES, TASK_STATUS, MESSAGE_ROLES, PART_TYPES } from "../../shared/index.js";
import { AdaptiveConcurrencyController } from "./adaptive-concurrency.js";
import { UnifiedTaskExecutor } from "./unified-task-executor.js";
import { SessionPool } from "./session-pool.js";
import { log } from "./logger.js";
import { formatDuration } from "./format.js";
import type { ParallelTask } from "./interfaces/parallel-task.interface.js";
import type { LaunchInput } from "./interfaces/launch-input.interface.js";

type OpencodeClient = PluginInput["client"];

export class ParallelAgentManager {
    private static _instance: ParallelAgentManager;

    private client: OpencodeClient;
    private directory: string;
    private adaptiveConcurrency: AdaptiveConcurrencyController;
    private sessionPool: SessionPool;
    private executor: UnifiedTaskExecutor;

    private constructor(client: OpencodeClient, directory: string) {
        this.client = client;
        this.directory = directory;

        // Initialize Adaptive Concurrency
        this.adaptiveConcurrency = new AdaptiveConcurrencyController({
            globalMax: 30,
            perAgentMax: 10,
            scaleUpThreshold: 0.9,
            scaleDownThreshold: 0.5,
        });

        // Initialize Session Pool
        this.sessionPool = SessionPool.getInstance(client, directory);

        // Initialize simplified executor
        this.executor = new UnifiedTaskExecutor(
            client,
            this.sessionPool,
            this.adaptiveConcurrency
        );

        log("[ParallelAgentManager] Modular system initialized with Adaptive Concurrency.");
    }

    static getInstance(client?: OpencodeClient, directory?: string): ParallelAgentManager {
        if (!ParallelAgentManager._instance) {
            if (!client || !directory) {
                throw new Error("ParallelAgentManager requires client and directory on first call");
            }
            ParallelAgentManager._instance = new ParallelAgentManager(client, directory);
        }
        return ParallelAgentManager._instance;
    }

    async launch(inputs: LaunchInput | LaunchInput[]): Promise<ParallelTask | ParallelTask[]> {
        if (Array.isArray(inputs)) {
            return Promise.all(inputs.map(input => this.executor.launch(input)));
        } else {
            return this.executor.launch(inputs);
        }
    }

    getTask(id: string): ParallelTask | undefined {
        return this.executor.getTask(id);
    }

    getAllTasks(): ParallelTask[] {
        return this.executor.getAllTasks();
    }

    getRunningTasks(): ParallelTask[] {
        return this.executor.getAllTasks().filter(t => t.status === TASK_STATUS.RUNNING);
    }

    getTasksByParent(parentID: string): ParallelTask[] {
        return this.executor.getTasksByParent(parentID);
    }

    async cancelTask(taskId: string): Promise<boolean> {
        const task = this.executor.getTask(taskId);
        if (!task) return false;

        try {
            await this.client.session.delete({ path: { id: task.sessionID } });
        } catch { }

        // Mark as error (cancelled)
        const anyExecutor = this.executor as any;
        if (anyExecutor.completeTask) {
            await anyExecutor.completeTask(task, false);
        }
        return true;
    }

    async getResult(taskId: string): Promise<string | null> {
        const task = this.executor.getTask(taskId);
        if (!task) return null;

        try {
            const response = await this.client.session.messages({ path: { id: task.sessionID } });
            const messages = (response.data ?? []) as any[];
            const lastMsg = messages.filter(m => m.info?.role === MESSAGE_ROLES.ASSISTANT).reverse()[0];
            if (!lastMsg) return "(No response yet)";

            return lastMsg.parts
                ?.filter((p: any) => p.type === PART_TYPES.TEXT || p.type === PART_TYPES.REASONING)
                .map((p: any) => p.text ?? "")
                .join("\n") || "";
        } catch (error) {
            return `Error fetching result: ${error}`;
        }
    }

    handleEvent(event: any): void {
        this.executor.handleEvent(event).catch(err => {
            log("[ParallelAgentManager] Error handling event:", err);
        });
    }

    getConcurrency(): AdaptiveConcurrencyController {
        return this.adaptiveConcurrency;
    }

    formatDuration = formatDuration;

    async cleanup(): Promise<void> {
        log("[ParallelAgentManager] Cleaning up...");
        await this.sessionPool.shutdown();
    }
}

// Ensure compatibility with singleton usage
export const parallelAgentManager = {
    getInstance: ParallelAgentManager.getInstance.bind(ParallelAgentManager),
    cleanup: () => {
        try {
            ParallelAgentManager.getInstance().cleanup();
        } catch { }
    }
};
