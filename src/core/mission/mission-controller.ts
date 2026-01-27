import type { PluginInput } from '@opencode-ai/plugin';
import { log } from '../agents/logger.js';
import { ResourceTracker } from '../resource/resource-tracker.js';
import { AGENT_NAMES, PROMPT_TAGS, SESSION_EVENTS } from '../../shared/index.js';
import { AGENTS } from '../../agents/definitions.js';

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

/**
 * MissionController
 * Handles the main autonomous loop using OpenCode Native APIs.
 */
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

        // 1. Create session via SDK
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
            maxIterations: 50, // Reasonable limit for a single mission
            startedAt: new Date().toISOString(),
            stagnationCount: 0,
        };

        // 2. Build Commander prompt with system definition
        const commanderDef = AGENTS[AGENT_NAMES.COMMANDER];
        const initialPrompt = this.buildCommanderPrompt(prompt);

        // 3. Send initial prompt
        await this.client.session.prompt({
            path: { id: sessionID },
            body: {
                parts: [{ type: 'text', text: initialPrompt }],
                agent: AGENT_NAMES.COMMANDER,
            }
        });

        return sessionID;
    }

    /**
     * Fetches native Todos for the current session.
     */
    async getTodos(): Promise<NativeTodo[]> {
        if (!this.state) return [];
        try {
            const response = await this.client.session.todo({ path: { id: this.state.sessionID } });
            return (response.data || []) as NativeTodo[];
        } catch (error) {
            log(`[MissionController] Error fetching todos: ${error}`);
            return [];
        }
    }

    /**
     * Moves to the next iteration if needed.
     * Called primarily when session becomes IDLE.
     */
    async nextIteration(): Promise<{ continue: boolean; prompt?: string; reason?: string }> {
        if (!this.state) return { continue: false, reason: 'No active mission' };

        // 1. Double check session status via SDK
        // Note: Using any here to bypass SDK type strictness if status response structure varies
        const statusResponse: any = await (this.client.session as any).status({
            path: { id: this.state.sessionID }
        });

        // If the session is busy, we don't start a new iteration yet
        const sessionStatus = statusResponse.data?.[this.state.sessionID] || statusResponse.data;
        if (sessionStatus?.type === 'busy' || (sessionStatus as any)?.status === 'busy') {
            return { continue: true, reason: 'Session still busy' };
        }

        const todos = await this.getTodos();
        const incomplete = todos.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

        // 2. Check completion: All todos finished
        if (todos.length > 0 && incomplete.length === 0) {
            this.state.status = 'completed';
            log(`[MissionController] Mission complete: ${this.state.sessionID.slice(0, 8)}`);
            return { continue: false, reason: 'All todos completed' };
        }

        // 3. Safety: Max iterations
        if (this.state.iteration >= this.state.maxIterations) {
            this.state.status = 'failed';
            log(`[MissionController] Mission reached max iterations (${this.state.maxIterations})`);
            return { continue: false, reason: 'Max iterations reached' };
        }

        // 4. Stagnation detection: Have todos changed since last IDLE?
        const todoHash = this.hashTodos(incomplete);
        let intervention: string | undefined;

        if (this.state.lastTodoHash === todoHash) {
            this.state.stagnationCount++;
            if (this.state.stagnationCount >= 2) { // More aggressive intervention (after 2 idles with no change)
                intervention = this.buildStagnationIntervention(incomplete);
                log(`[MissionController] STAGNATION DETECTED in ${this.state.sessionID.slice(0, 8)}`);
            }
        } else {
            this.state.stagnationCount = 0;
            this.state.lastTodoHash = todoHash;
        }

        this.state.iteration++;
        const nextPrompt = this.buildContinuationPrompt(incomplete, intervention);

        // 5. Send continuation prompt
        await this.client.session.prompt({
            path: { id: this.state.sessionID },
            body: {
                parts: [{ type: 'text', text: nextPrompt }],
                agent: AGENT_NAMES.COMMANDER,
            }
        });

        log(`[MissionController] Iteration ${this.state.iteration} started for ${this.state.sessionID.slice(0, 8)}`);
        return { continue: true, prompt: nextPrompt };
    }

    public buildCommanderPrompt(objective: string): string {
        const commanderDef = AGENTS[AGENT_NAMES.COMMANDER];
        return `
${PROMPT_TAGS.SYSTEM.open}
${commanderDef.systemPrompt}
${PROMPT_TAGS.SYSTEM.close}

${PROMPT_TAGS.MISSION.open}
**MISSION OBJECTIVE**: ${objective}

Follow these steps:
1.  **Analyze**: Understand the codebase and technical requirements.
2.  **Plan**: Create a structured plan using the \`todowrite\` tool.
3.  **Execute**: Actively use sub-agents via \`delegate_task\` or execute directly.
4.  **Verify**: Ensure every step is verified before marking it complete.
${PROMPT_TAGS.MISSION.close}

Proceed with the first step (Analyze & Plan).`;
    }

    public buildContinuationPrompt(pending: NativeTodo[], intervention?: string): string {
        const progressHeader = `Iteration ${this.state!.iteration}/${this.state!.maxIterations}`;

        let prompt = `## 🔄 Mission Status: ${progressHeader}\n\n`;

        if (intervention) {
            prompt += `> ⚠️ **STRATEGY ALERT**: ${intervention}\n\n`;
        }

        prompt += `### 📋 Remaining Tasks\n`;
        if (pending.length > 0) {
            prompt += pending.map(t => `- [${t.status === 'in_progress' ? '...' : ' '}] ${t.content} (${t.priority})`).join('\n');
        } else {
            prompt += `_No tasks found in TODO list. Please update it using \`todowrite\`._`;
        }

        prompt += `\n\n**Continue execution towards the objective.**`;

        return prompt;
    }

    private buildStagnationIntervention(pending: NativeTodo[]): string {
        return `It appears the mission is stagnated. No changes were made to the TODO list in the last two cycles.
        
**Please re-evaluate your approach:**
1.  If you are blocked, identify the specific blocker and ask for research or use specialized tools.
2.  Break down the current task into smaller, more manageable sub-tasks.
3.  If a task is impossible, explain why and mark it as 'cancelled'.
4.  **DO NOT SIMPLY RE-RUN THE SAME STEPS.** Change your methodology.`;
    }

    private hashTodos(todos: NativeTodo[]): string {
        if (todos.length === 0) return 'empty';
        return todos.map(t => `${t.id}:${t.status}`).sort().join('|');
    }

    getState(): MissionState | null {
        return this.state;
    }
}
