/**
 * Test Utilities - Main Entry Point
 *
 * This module exports all test utilities for easy importing.
 *
 * @example
 * ```ts
 * import { tmpdir, createParallelTask, mockConsole } from "@/tests/harness";
 *
 * describe("My test", () => {
 *   let consoleMock;
 *
 *   beforeEach(() => {
 *     consoleMock = mockConsole();
 *     consoleMock.setup();
 *   });
 *
 *   afterEach(() => {
 *     consoleMock.restore();
 *   });
 *
 *   it("should work", async () => {
 *     await using tmp = await tmpdir({ git: true });
 *     const task = createParallelTask({ description: "Test" });
 *     expect(task.status).toBe("pending");
 *   });
 * });
 * ```
 *
 * @module tests/harness
 */

// Re-export fixture utilities
export {
    tmpdir,
    tmpdirSync,
    createMockFs,
    waitFor,
} from "./fixture";

// Re-export builders
export {
    createParallelTask,
    createParallelTasks,
    createBackgroundTask,
    createTodo,
    createTodos,
    createMockClient,
    createMockState,
    resetBuilderCounters,
} from "./builders";

// Re-export mocks
export {
    mockConsole,
    mockProcessExit,
    useFakeTimers,
    createMockEmitter,
    createMockAbortController,
    resetAllMocks,
} from "./mocks";
