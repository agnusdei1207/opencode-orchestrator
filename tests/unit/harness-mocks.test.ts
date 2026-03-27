import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    mockConsole,
    mockProcessExit,
    useFakeTimers,
    createMockEmitter,
    createMockAbortController,
    resetAllMocks,
} from "../harness";

describe("harness/mocks", () => {
    describe("mockConsole", () => {
        it("mocks console methods", () => {
            const mc = mockConsole();
            mc.setup();

            console.log("test log");
            console.error("test error");
            console.warn("test warn");
            console.info("test info");

            const output = mc.getOutput();
            expect(output.log).toContain("test log");
            expect(output.error).toContain("test error");
            expect(output.warn).toContain("test warn");
            expect(output.info).toContain("test info");

            mc.restore();
        });

        it("restores original console methods", () => {
            const mc = mockConsole();
            mc.setup();
            mc.restore();

            expect(console.log).toBe(console.log);
        });
    });

    describe("mockProcessExit", () => {
        it("mocks process.exit", () => {
            const me = mockProcessExit();
            me.setup();

            process.exit(1);

            expect(me.mock).toHaveBeenCalledWith(1);
            expect(me.getExitCode()).toBe(1);

            me.restore();
        });

        it("restores original exit", () => {
            const me = mockProcessExit();
            me.setup();
            me.restore();

            expect(process.exit).toBe(process.exit);
        });
    });

    describe("useFakeTimers", () => {
        it("advances timers", () => {
            const timers = useFakeTimers();

            let called = false;
            setTimeout(() => {
                called = true;
            }, 1000);

            expect(called).toBe(false);
            timers.advance(1000);
            expect(called).toBe(true);

            timers.restore();
        });

        it("runs all pending timers", () => {
            const timers = useFakeTimers();

            let count = 0;
            setTimeout(() => count++, 100);
            setTimeout(() => count++, 200);

            timers.runAll();
            expect(count).toBe(2);

            timers.restore();
        });
    });

    describe("createMockEmitter", () => {
        it("registers and calls listeners", () => {
            const emitter = createMockEmitter<{
                test: [string];
                hello: [number, string];
            }>();

            const handler1 = vi.fn();
            const handler2 = vi.fn();

            emitter.on("test", handler1);
            emitter.on("hello", handler2);

            emitter.emit("test", "arg");
            emitter.emit("hello", 1, "world");

            expect(handler1).toHaveBeenCalledWith("arg");
            expect(handler2).toHaveBeenCalledWith(1, "world");
        });

        it("removes listeners", () => {
            const emitter = createMockEmitter<{ test: [string] }>();

            const handler = vi.fn();
            emitter.on("test", handler);
            emitter.off("test", handler);

            emitter.emit("test", "arg");

            expect(handler).not.toHaveBeenCalled();
        });

        it("clears all listeners", () => {
            const emitter = createMockEmitter<{ test: [string] }>();

            const handler = vi.fn();
            emitter.on("test", handler);
            emitter.removeAllListeners();

            emitter.emit("test", "arg");

            expect(handler).not.toHaveBeenCalled();
        });

        it("reports listener count", () => {
            const emitter = createMockEmitter<{ test: [string] }>();

            const h1 = vi.fn();
            const h2 = vi.fn();

            expect(emitter.listenerCount("test")).toBe(0);

            emitter.on("test", h1);
            expect(emitter.listenerCount("test")).toBe(1);

            emitter.on("test", h2);
            expect(emitter.listenerCount("test")).toBe(2);

            emitter.off("test", h1);
            expect(emitter.listenerCount("test")).toBe(1);
        });
    });

    describe("createMockAbortController", () => {
        it("creates controller with timeout", () => {
            const ac = createMockAbortController(100);

            expect(ac.signal.aborted).toBe(false);

            ac.abort();

            expect(ac.signal.aborted).toBe(true);
        });

        it("aborts via timeout", () => {
            const timers = useFakeTimers();
            const ac = createMockAbortController(1000);

            expect(ac.signal.aborted).toBe(false);

            timers.advance(1000);

            expect(ac.signal.aborted).toBe(true);

            timers.restore();
        });

        it("calls registered abort listeners", () => {
            const ac = createMockAbortController();

            const listener = vi.fn();
            ac.signal.addEventListener("abort", listener);

            ac.abort("test reason");

            expect(listener).toHaveBeenCalled();
        });

        it("does nothing on double abort", () => {
            const ac = createMockAbortController();

            ac.abort();
            ac.abort();

            expect(ac.signal.aborted).toBe(true);
        });
    });

    describe("resetAllMocks", () => {
        it("clears all mocks and timers", () => {
            resetAllMocks();
        });
    });
});
