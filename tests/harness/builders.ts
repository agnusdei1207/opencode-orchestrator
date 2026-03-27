import type { ParallelTask } from "../../src/shared/task/interfaces/parallel-task";
import type { BackgroundTask } from "../../src/shared/command/interfaces/background-task";
import type { Todo } from "../../src/shared/loop/interfaces/todo";
import type { ParallelTaskStatus } from "../../src/shared/task/types/parallel-task-status";
import type { BackgroundTaskStatus } from "../../src/shared/command/types/background-task-status";
import type { TodoStatus } from "../../src/shared/loop/types/todo-status";
import type { TodoPriority } from "../../src/shared/loop/types/todo-priority";
import { vi } from "vitest";

let taskCounter = 0;

export interface CreateParallelTaskOptions {
    id?: string;
    sessionId?: string;
    description?: string;
    prompt?: string;
    status?: ParallelTaskStatus;
    category?: string;
    createdAt?: Date;
    completedAt?: Date;
    result?: unknown;
    error?: string;
}

export function createParallelTask(options: CreateParallelTaskOptions = {}): ParallelTask {
    const id = options.id ?? `test-task-${++taskCounter}`;
    const now = new Date();

    return {
        id,
        sessionID: options.sessionId ?? `session-${id}`,
        parentSessionID: `parent-${id}`,
        description: options.description ?? `Test task ${id}`,
        prompt: options.prompt ?? "Test prompt",
        agent: "test",
        status: options.status ?? "pending",
        startedAt: options.createdAt ?? now,
        completedAt: options.completedAt,
        result: options.result as string | undefined,
        error: options.error,
        depth: 0,
        reset: () => {
            taskCounter++;
        },
    };
}

export function createParallelTasks(count: number, options?: CreateParallelTaskOptions): ParallelTask[] {
    return Array.from({ length: count }, (_, i) =>
        createParallelTask({
            ...options,
            id: options?.id ? `${options.id}-${i}` : undefined,
            description: options?.description ? `${options.description} ${i + 1}` : undefined,
        })
    );
}

let bgTaskCounter = 0;

export interface CreateBackgroundTaskOptions {
    id?: string;
    command?: string;
    cwd?: string;
    status?: BackgroundTaskStatus;
    output?: string;
    errorOutput?: string;
    exitCode?: number | null;
    startTime?: number;
    endTime?: number;
    timeout?: number;
}

export function createBackgroundTask(options: CreateBackgroundTaskOptions = {}): BackgroundTask {
    const id = options.id ?? `bg-task-${++bgTaskCounter}`;
    const now = Date.now();

    return {
        id,
        command: options.command ?? "echo test",
        args: [],
        cwd: options.cwd ?? process.cwd(),
        status: options.status ?? "running",
        output: options.output ?? "",
        errorOutput: options.errorOutput ?? "",
        exitCode: options.exitCode ?? null,
        startTime: options.startTime ?? now,
        endTime: options.endTime,
        timeout: options.timeout ?? 30000,
    };
}

let todoCounter = 0;

export interface CreateTodoOptions {
    id?: string;
    content?: string;
    status?: TodoStatus;
    priority?: TodoPriority;
    createdAt?: Date;
}

export function createTodo(options: CreateTodoOptions = {}): Todo {
    const id = options.id ?? `todo-${++todoCounter}`;
    const now = new Date();

    return {
        id,
        content: options.content ?? `Test todo ${id}`,
        status: options.status ?? "pending",
        priority: options.priority ?? "medium",
        createdAt: options.createdAt ?? now,
    };
}

export function createTodos(count: number, options?: CreateTodoOptions): Todo[] {
    return Array.from({ length: count }, (_, i) =>
        createTodo({
            ...options,
            id: options?.id ? `${options.id}-${i}` : undefined,
            content: options?.content ? `${options.content} ${i + 1}` : undefined,
        })
    );
}

export function createMockClient(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        toast: {
            show: vi.fn(),
            update: vi.fn(),
            dismiss: vi.fn(),
        },
        session: {
            create: vi.fn(),
            get: vi.fn(),
            list: vi.fn(),
            send: vi.fn(),
        },
        tool: {
            execute: vi.fn(),
            list: vi.fn(),
        },
        ...overrides,
    };
}

export function createMockState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        missionId: "test-mission",
        currentPhase: "discovery",
        todos: [],
        completedSteps: [],
        errors: [],
        startTime: new Date(),
        ...overrides,
    };
}

export function resetBuilderCounters(): void {
    taskCounter = 0;
    bgTaskCounter = 0;
    todoCounter = 0;
}
