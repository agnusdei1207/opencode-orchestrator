/**
 * Shared Mock Utilities
 *
 * Provides commonly used mock patterns and utilities
 * for consistent testing across the codebase.
 *
 * @module tests/harness/mocks
 */

import { vi } from "vitest";

// ============================================================================
// Console Mock
// ============================================================================

/**
 * Mock console methods for cleaner test output
 */
export function mockConsole() {
    const original = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info,
    };

    const mocks = {
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    };

    return {
        setup: () => {
            console.log = mocks.log;
            console.error = mocks.error;
            console.warn = mocks.warn;
            console.info = mocks.info;
        },
        restore: () => {
            console.log = original.log;
            console.error = original.error;
            console.warn = original.warn;
            console.info = original.info;
        },
        mocks,
        getOutput: () => ({
            log: mocks.log.mock.calls.flat().join("\n"),
            error: mocks.error.mock.calls.flat().join("\n"),
            warn: mocks.warn.mock.calls.flat().join("\n"),
            info: mocks.info.mock.calls.flat().join("\n"),
        }),
    };
}

// ============================================================================
// Process Mock
// ============================================================================

/**
 * Mock process.exit for testing error paths
 */
export function mockProcessExit() {
    const originalExit = process.exit;
    const exitMock = vi.fn();

    return {
        setup: () => {
            Object.defineProperty(process, "exit", {
                value: exitMock,
                writable: true,
                configurable: true,
            });
        },
        restore: () => {
            Object.defineProperty(process, "exit", {
                value: originalExit,
                writable: true,
                configurable: true,
            });
        },
        mock: exitMock,
        getExitCode: () => exitMock.mock.calls[0]?.[0] ?? null,
    };
}

// ============================================================================
// Timer Mocks
// ============================================================================

/**
 * Create fake timers with automatic cleanup
 */
export function useFakeTimers() {
    vi.useFakeTimers();

    return {
        advance: (ms: number) => vi.advanceTimersByTime(ms),
        runAll: () => vi.runAllTimers(),
        runOnlyPending: () => vi.runOnlyPendingTimers(),
        restore: () => vi.useRealTimers(),
    };
}

// ============================================================================
// File System Mock
// ============================================================================

/**
 * Create an in-memory file system mock
 */
export function createMockFs(initialFiles: Record<string, string> = {}) {
    const files = new Map<string, string>(Object.entries(initialFiles));

    return {
        existsSync: (path: string) => files.has(path),
        readFileSync: (path: string) => {
            const content = files.get(path);
            if (content === undefined) {
                const error = new Error(`ENOENT: ${path}`);
                (error as any).code = "ENOENT";
                throw error;
            }
            return content;
        },
        writeFileSync: (path: string, content: string) => {
            files.set(path, content);
        },
        unlinkSync: (path: string) => {
            files.delete(path);
        },
        readdirSync: (path: string) => {
            const entries: string[] = [];
            for (const key of files.keys()) {
                if (key.startsWith(path + "/")) {
                    const relative = key.slice(path.length + 1);
                    if (!relative.includes("/")) {
                        entries.push(relative);
                    }
                }
            }
            return entries;
        },
        mkdirSync: vi.fn(),
        files,
    };
}

// ============================================================================
// Event Emitter Mock
// ============================================================================

/**
 * Create a mock event emitter for testing
 */
export function createMockEmitter<T extends Record<string, any[]>>() {
    const listeners = new Map<string, Set<(...args: any[]) => void>>();

    return {
        on: vi.fn(<K extends keyof T>(event: K, listener: (...args: T[K]) => void) => {
            const set = listeners.get(event as string) ?? new Set();
            set.add(listener);
            listeners.set(event as string, set);
        }),
        off: vi.fn(<K extends keyof T>(event: K, listener: (...args: T[K]) => void) => {
            listeners.get(event as string)?.delete(listener);
        }),
        emit: vi.fn(<K extends keyof T>(event: K, ...args: T[K]) => {
            const set = listeners.get(event as string);
            if (set) {
                for (const listener of set) {
                    listener(...args);
                }
            }
        }),
        removeAllListeners: vi.fn((event?: string) => {
            if (event) {
                listeners.delete(event);
            } else {
                listeners.clear();
            }
        }),
        listenerCount: (event: string) => listeners.get(event)?.size ?? 0,
    };
}

// ============================================================================
// AbortController Mock
// ============================================================================

/**
 * Create a mock AbortController with timeout support
 */
export function createMockAbortController(timeoutMs?: number) {
    let aborted = false;
    let reason: any = undefined;
    const listeners = new Set<() => void>();

    const signal = {
        get aborted() {
            return aborted;
        },
        get reason() {
            return reason;
        },
        addEventListener: vi.fn((_type: string, listener: () => void) => {
            listeners.add(listener);
        }),
        removeEventListener: vi.fn((_type: string, listener: () => void) => {
            listeners.delete(listener);
        }),
        throwIfAborted: () => {
            if (aborted) throw reason;
        },
    };

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (timeoutMs) {
        timeoutId = setTimeout(() => {
            controller.abort(new Error(`Abort timeout after ${timeoutMs}ms`));
        }, timeoutMs);
    }

    const controller = {
        signal,
        abort: vi.fn((abortReason?: any) => {
            if (aborted) return;
            aborted = true;
            reason = abortReason ?? new Error("Aborted");
            if (timeoutId) clearTimeout(timeoutId);
            for (const listener of listeners) {
                listener();
            }
        }),
    };

    return controller;
}

// ============================================================================
// Global State Reset
// ============================================================================

/**
 * Reset all common mocks - call in afterEach
 */
export function resetAllMocks() {
    vi.clearAllMocks();
    vi.clearAllTimers();
}
