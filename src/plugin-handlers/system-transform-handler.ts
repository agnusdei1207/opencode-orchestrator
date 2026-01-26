/**
 * System Transform Handler
 * 
 * Hook: experimental.chat.system.transform
 * 
 * Dynamically injects agent-specific system prompts based on the current
 * session context and orchestrator state.
 */

import type { EventHandlerContext, SystemTransformInput, SystemTransformOutput } from "./interfaces/index.js";
import { readLoopState, isLoopActive } from "../core/loop/mission-loop.js";
import { MISSION_CONTROL, STATUS_LABEL, PATHS } from "../shared/index.js";
import { ParallelAgentManager } from "../core/agents/manager.js";
import { isMissionActive, ensureSessionInitialized } from "../core/orchestrator/session-manager.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTodoMd } from "../core/sync/todo-parser.js";

// Re-export interfaces for external use
export type { SystemTransformInput, SystemTransformOutput } from "./interfaces/index.js";

/**
 * Create system transform handler for dynamic prompt injection
 */
export function createSystemTransformHandler(ctx: EventHandlerContext) {
    const { directory, sessions, state } = ctx;

    return async (input: SystemTransformInput, output: SystemTransformOutput): Promise<void> => {
        const { sessionID } = input;

        // Check if this is an orchestrated session
        const loopState = readLoopState(directory);
        const isActiveLoop = isMissionActive(sessionID, directory) || (loopState?.active && loopState?.sessionID === sessionID);
        const session = ensureSessionInitialized(sessions, sessionID, directory);

        // Only inject for orchestrated sessions
        if (!isActiveLoop) {
            return;
        }

        // Build system prompt additions
        const systemAdditions: string[] = [];

        // 1. Mission loop context (if active)
        if (isActiveLoop && loopState) {
            // FUNDAMENTAL: Inject full Commander instructions via system transform
            // This prevents massive prompt injection in user messages.
            const { commander } = await import("../agents/commander.js");
            systemAdditions.push(commander.systemPrompt);
            systemAdditions.push(buildMissionLoopSystemPrompt(loopState.iteration, loopState.maxIterations));
        }

        // 2. Active session context
        if (session?.active) {
            systemAdditions.push(buildActiveSessionPrompt(session.step));
        }

        // 3. Background task awareness
        try {
            const manager = ParallelAgentManager.getInstance();
            const tasks = manager.getTasksByParent(sessionID);
            const runningCount = tasks.filter(t => t.status === STATUS_LABEL.RUNNING).length;
            const pendingCount = tasks.filter(t => t.status === STATUS_LABEL.PENDING).length;

            if (runningCount > 0 || pendingCount > 0) {
                systemAdditions.push(buildBackgroundTasksPrompt(runningCount, pendingCount));
            }
        } catch {
            // Manager not available
        }

        // 4. TODO awareness - inject TODO list into system prompt
        //    AI will naturally use the built-in 'todowrite' tool to update TODOs
        const todoPath = join(directory, PATHS.TODO);
        if (existsSync(todoPath)) {
            try {
                const todoContent = readFileSync(todoPath, 'utf-8');
                const todos = parseTodoMd(todoContent);
                if (todos.length > 0) {
                    systemAdditions.push(buildTodoPrompt(todos));
                }
            } catch {
                // Failed to read TODO file
            }
        }

        // Inject additions
        if (systemAdditions.length > 0) {
            output.system.unshift(...systemAdditions); // unshift to put core instructions first
        }
    };
}

/**
 * Build mission loop system prompt
 */
function buildMissionLoopSystemPrompt(iteration: number, maxIterations: number): string {
    return `<orchestrator_mission_loop>
🎯 MISSION LOOP ACTIVE: Iteration ${iteration}/${maxIterations}

You are in an autonomous mission loop. Continue working until ALL tasks are verified and 100% complete.

COMPLETION CRITERIA:
- All hierarchical items in .opencode/todo.md are marked [x]
- .opencode/verification-checklist.md is fully checked off [x]
- All tests pass and builds succeed

DO NOT stop or ask for permission. Execute autonomously.
</orchestrator_mission_loop>`;
}

/**
 * Build active session prompt
 */
function buildActiveSessionPrompt(stepCount: number): string {
    return `<orchestrator_session>
📊 Orchestrator Session Active
- Steps executed: ${stepCount}
- Mode: Autonomous execution
- Status: Continue working
</orchestrator_session>`;
}

/**
 * Build background tasks prompt
 */
function buildBackgroundTasksPrompt(running: number, pending: number): string {
    return `<orchestrator_background_tasks>
⚡ Background Tasks Status:
- Running: ${running}
- Pending: ${pending}

Use \`get_task_result\` to check completed tasks.
Use \`delegate_task\` with background=true for parallel work.
</orchestrator_background_tasks>`;
}

/**
 * Build TODO awareness prompt
 */
function buildTodoPrompt(todos: Array<{ id: string; content: string; status: string; priority: string }>): string {
    const incompleteTodos = todos.filter(t => t.status !== 'completed');
    const totalCount = todos.length;
    const completeCount = totalCount - incompleteTodos.length;

    if (incompleteTodos.length === 0) {
        return `<orchestrator_todos>
✅ All TODOs Complete (${completeCount}/${totalCount})

All tasks in .opencode/todo.md are finished.
</orchestrator_todos>`;
    }

    const todoList = incompleteTodos
        .map(t => `  - [${t.status === 'in_progress' ? '~' : ' '}] ${t.content} (${t.priority})`)
        .join('\n');

    return `<orchestrator_todos>
📝 TODO List (${completeCount}/${totalCount} complete):

${todoList}

Use the built-in \`todowrite\` tool to update TODO status as you complete tasks.
When you finish a task, mark it as completed in the TODO list.
</orchestrator_todos>`;
}
