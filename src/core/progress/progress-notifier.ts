import { stateBroadcaster, MissionState } from "./state-broadcaster.js";
import { ParallelAgentManager } from "../agents/manager.js";
import { getTaskToastManager } from "../notification/task-toast-manager.js";
import { TASK_STATUS } from "../../shared/index.js";

export class ProgressNotifier {
    private static _instance: ProgressNotifier;
    private manager: ParallelAgentManager | null = null;

    private constructor() {
        // Subscribe to broadcasts if we want to trigger external side effects (like OS notifications)
        stateBroadcaster.subscribe(this.handleStateChange.bind(this));
    }

    static getInstance(): ProgressNotifier {
        if (!ProgressNotifier._instance) {
            ProgressNotifier._instance = new ProgressNotifier();
        }
        return ProgressNotifier._instance;
    }

    setManager(manager: ParallelAgentManager) {
        this.manager = manager;
    }

    /**
     * Poll current status from ParallelAgentManager and broadcast it
     */
    update() {
        if (!this.manager) return;

        const tasks = this.manager.getAllTasks();
        const running = tasks.filter(t => t.status === TASK_STATUS.RUNNING);
        const completed = tasks.filter(t => t.status === TASK_STATUS.COMPLETED);

        const total = tasks.length;
        const percentage = total > 0 ? Math.round((completed.length / total) * 100) : 0;

        const state: MissionState = {
            missionId: "current-mission", // Could be dynamic
            status: percentage === 100 ? 'completed' : 'executing',
            progress: {
                totalTasks: total,
                completedTasks: completed.length,
                percentage,
            },
            activeAgents: running.map(t => ({
                id: t.id,
                type: t.agent,
                status: t.status,
                currentTask: t.description,
            })),
            todo: [], // Need to fetch from TodoEnforcer if possible
            lastUpdated: new Date(),
        };

        stateBroadcaster.broadcast(state);
    }

    private handleStateChange(state: MissionState) {
        // Handle milestone notifications
        if (state.progress.percentage > 0 && state.progress.percentage % 25 === 0) {
            const toastManager = getTaskToastManager();
            if (toastManager) {
                // We could add a generic toast here if needed
            }
        }
    }
}

export const progressNotifier = ProgressNotifier.getInstance();
