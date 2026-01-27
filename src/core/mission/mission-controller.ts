import type { PluginInput } from '@opencode-ai/plugin';
import { log } from '../agents/logger';
import { ResourceTracker } from '../resource/resource-tracker';

/**
 * Native Todo interface from OpenCode SDK
 */
export interface NativeTodo {
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority: 'high' | 'medium' | 'low';
}

interface MissionState {
    id: string;
    sessionID: string;
    prompt: string;
    status: 'active' | 'completed' | 'failed';
    iteration: number;
    maxIterations: number;
    startedAt: string;
    lastTodoHash?: string;
    stagnationCount: number;
}

export class MissionController {
    private state: MissionState | null = null;
    private client: PluginInput['client'];

    constructor(input: PluginInput) {
        this.client = input.client;
    }

    /**
     * Starts a new mission by creating a session and sending the commander prompt.
     */
    async start(prompt: string): Promise<string> {
        log(`[MissionController] Starting new mission: ${prompt}`);

        // Create session via SDK
        const sessionResponse = await this.client.session.create({});
        if (sessionResponse.error || !sessionResponse.data?.id) {
            throw new Error(`Failed to create mission session: ${sessionResponse.error}`);
        }

        const sessionID = sessionResponse.data.id;

        this.state = {
            id: crypto.randomUUID(),
            sessionID,
            prompt,
            status: 'active',
            iteration: 1,
            maxIterations: 100, // Safe upper bound, but practically infinite due to stagnation checks
            startedAt: new Date().toISOString(),
            stagnationCount: 0,
        };

        // Send Commander prompt
        await this.client.session.prompt({
            path: { id: sessionID },
            body: {
                parts: [{ type: 'text', text: this.buildCommanderPrompt(prompt) }],
            }
        });

        return sessionID;
    }

    /**
     * Fetches native Todos for the current session.
     */
    async getTodos(): Promise<NativeTodo[]> {
        if (!this.state) return [];
        const response = await this.client.session.todo({ path: { id: this.state.sessionID } });
        return (response.data || []) as NativeTodo[];
    }

    /**
     * Checks if all todos are completed or cancelled.
     */
    async checkComplete(): Promise<boolean> {
        const todos = await this.getTodos();
        if (todos.length === 0) return false;
        return todos.every(t => t.status === 'completed' || t.status === 'cancelled');
    }

    /**
     * Moves to the next iteration if needed.
     * Called primarily when session becomes IDLE.
     */
    async nextIteration(): Promise<{ continue: boolean; prompt?: string; reason?: string }> {
        if (!this.state) return { continue: false, reason: 'No active mission' };

        // Check session status
        const statusResponse: any = await (this.client.session as any).status({
            path: { id: this.state.sessionID }
        });
        if (statusResponse.data?.status?.type === 'busy') {
            return { continue: true, reason: 'Session still busy' };
        }

        const todos = await this.getTodos();
        const incomplete = todos.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

        // Check completion
        if (todos.length > 0 && incomplete.length === 0) {
            this.state.status = 'completed';
            log(`[MissionController] All tasks completed for session ${this.state.sessionID}`);
            return { continue: false, reason: 'All todos completed' };
        }

        // Check max iterations (safety)
        if (this.state.iteration >= this.state.maxIterations) {
            this.state.status = 'failed';
            return { continue: false, reason: 'Max iterations reached' };
        }

        // Stagnation detection
        const todoHash = this.hashTodos(incomplete);
        let intervention: string | undefined;

        if (this.state.lastTodoHash === todoHash) {
            this.state.stagnationCount++;
            if (this.state.stagnationCount >= 3) {
                intervention = this.buildStagnationIntervention(incomplete);
                log(`[MissionController] Stagnation detected (${this.state.stagnationCount}), injecting intervention`);
            }
        } else {
            this.state.stagnationCount = 0;
            this.state.lastTodoHash = todoHash;
        }

        this.state.iteration++;
        const prompt = this.buildContinuationPrompt(incomplete, intervention);

        // Continue with next prompt
        await this.client.session.prompt({
            path: { id: this.state.sessionID },
            body: {
                parts: [{ type: 'text', text: prompt }],
            }
        });

        log(`[MissionController] Continuing iteration ${this.state.iteration} for session ${this.state.sessionID}`);
        return { continue: true, prompt };
    }

    private buildCommanderPrompt(prompt: string): string {
        return `## 🚀 Mission Mode Activated

**Objective:** ${prompt}

You are the Commander agent. Your responsibilities:
1. Analyze the objective and create a detailed TODO list using the \`todowrite\` tool.
2. Execute tasks systematically, updating todo status (pending -> in_progress -> completed/cancelled) as you progress.
3. Verify completion of each task before moving to the next.

Start by exploring the codebase and creating your initial TODO list.`;
    }

    private buildContinuationPrompt(pending: NativeTodo[], intervention?: string): string {
        const progressText = `[${pending.filter(t => t.status === 'in_progress').length} in progress, ${pending.filter(t => t.status === 'pending').length} pending]`;

        return `## 🔄 Continue Mission (Iteration ${this.state!.iteration}/${this.state!.maxIterations})

${intervention ? `⚠️ **CRITICAL INTERVENTION**: ${intervention}\n\n` : ''}

### Current Progress ${progressText}
${pending.map(t => `- [${t.status === 'in_progress' ? '~' : ' '}] ${t.content} (${t.priority})`).join('\n')}

**Continue working on the objective. Ensure you update the todo status using \`todowrite\` to reflect your progress.**`;
    }

    private buildStagnationIntervention(pending: NativeTodo[]): string {
        return `No progress has been detected in the TODO list for multiple iterations.

**You MUST change your strategy:**
1. If a task is blocked, mark it as 'cancelled' with a clear explanation of why.
2. If the task is too complex, break it down into smaller sub-tasks.
3. If you are stuck in a loop, explain the hurdle and try a different approach.
4. Do NOT simply repeat the same actions.`;
    }

    private hashTodos(todos: NativeTodo[]): string {
        return todos.map(t => `${t.id}:${t.status}`).sort().join('|');
    }

    getState(): MissionState | null {
        return this.state;
    }

    reset(): void {
        if (this.state) {
            ResourceTracker.getInstance().releaseAllForSession(this.state.sessionID).catch(() => { });
        }
        this.state = null;
    }
}
