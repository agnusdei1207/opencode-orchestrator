import { Todo } from "../loop/todo-enforcer.js";

export interface MissionState {
    missionId: string;
    status: 'planning' | 'executing' | 'reviewing' | 'completed' | 'failed';
    progress: {
        totalTasks: number;
        completedTasks: number;
        percentage: number;
    };
    activeAgents: {
        id: string;
        type: string;
        status: string;
        currentTask?: string;
    }[];
    todo: Todo[];
    lastUpdated: Date;
}

export class StateBroadcaster {
    private static _instance: StateBroadcaster;
    private listeners = new Set<(state: MissionState) => void>();
    private currentState: MissionState | null = null;

    private constructor() { }

    static getInstance(): StateBroadcaster {
        if (!StateBroadcaster._instance) {
            StateBroadcaster._instance = new StateBroadcaster();
        }
        return StateBroadcaster._instance;
    }

    subscribe(listener: (state: MissionState) => void) {
        this.listeners.add(listener);
        if (this.currentState) {
            listener(this.currentState);
        }
        return () => this.listeners.delete(listener);
    }

    broadcast(state: MissionState) {
        this.currentState = state;
        this.listeners.forEach(listener => {
            try {
                listener(state);
            } catch (error) {
                // Ignore listener errors
            }
        });
    }

    getCurrentState(): MissionState | null {
        return this.currentState;
    }
}

export const stateBroadcaster = StateBroadcaster.getInstance();
