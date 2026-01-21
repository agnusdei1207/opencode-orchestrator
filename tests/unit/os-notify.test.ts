/**
 * OS Native Notification Tests
 * 
 * Comprehensive tests for the os-notify system.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { detectPlatform, getDefaultSoundPath } from "../../src/core/notification/os-notify/platform";
import { hasIncompleteTodos } from "../../src/core/notification/os-notify/todo-checker";
import { PLATFORM } from "../../src/shared/os/index.js";
import { TODO_STATUS } from "../../src/shared/loop/index.js";
import { ParallelAgentManager } from "../../src/core/agents/manager.js";
import { isSessionRecovering } from "../../src/core/recovery/session-recovery.js";

// --- Mocks ---

// Mock log
vi.mock("../../src/core/agents/logger.js", () => ({
    log: vi.fn(),
}));

// Mock child_process
const mockExec = vi.fn();
vi.mock("node:child_process", () => ({
    exec: vi.fn((cmd: string, cb?: any) => {
        mockExec(cmd);
        if (cb) cb(null, "", "");
        return { on: vi.fn() };
    }),
}));

// Mock platform-resolver
const mockResolveCommandPath = vi.fn();
vi.mock("../../src/core/notification/os-notify/platform-resolver", () => ({
    resolveCommandPath: (key: string, name: string) => mockResolveCommandPath(key, name),
}));

// Mock todo-checker
vi.mock("../../src/core/notification/os-notify/todo-checker", async () => {
    const actual = await vi.importActual("../../src/core/notification/os-notify/todo-checker") as any;
    return {
        ...actual,
        hasIncompleteTodos: vi.fn(actual.hasIncompleteTodos),
    };
});

// Mock ParallelAgentManager
const mockGetTasksByParent = vi.fn();
vi.mock("../../src/core/agents/manager.js", () => ({
    ParallelAgentManager: {
        getInstance: vi.fn(() => ({
            getTasksByParent: mockGetTasksByParent
        }))
    }
}));

// Mock Session Recovery
vi.mock("../../src/core/recovery/session-recovery.js", () => ({
    isSessionRecovering: vi.fn(),
}));

// Mock Mission Seal
vi.mock("../../src/core/loop/mission-seal.js", () => ({
    isLoopActive: vi.fn(),
}));

// --- Tests ---

describe("os-notify/platform", () => {
    it("detectPlatform returns valid platform", () => {
        const platform = detectPlatform();
        expect([PLATFORM.DARWIN, PLATFORM.LINUX, PLATFORM.WIN32, PLATFORM.UNSUPPORTED]).toContain(platform);
    });

    it("getDefaultSoundPath returns empty strings for OS built-ins", () => {
        expect(getDefaultSoundPath(PLATFORM.DARWIN)).toBe("");
        expect(getDefaultSoundPath(PLATFORM.LINUX)).toBe("");
        expect(getDefaultSoundPath(PLATFORM.WIN32)).toBe("");
    });
});

describe("os-notify/todo-checker", () => {
    it("should return true if incomplete todos exist", async () => {
        const mockClient = {
            session: {
                todo: vi.fn().mockResolvedValue({
                    data: [
                        { status: TODO_STATUS.COMPLETED },
                        { status: TODO_STATUS.PENDING }
                    ]
                })
            }
        };
        const result = await hasIncompleteTodos(mockClient as any, "session-1");
        expect(result).toBe(true);
    });

    it("should return false if all todos are completed/cancelled", async () => {
        const mockClient = {
            session: {
                todo: vi.fn().mockResolvedValue({
                    data: [
                        { status: TODO_STATUS.COMPLETED },
                        { status: TODO_STATUS.CANCELLED }
                    ]
                })
            }
        };
        const result = await hasIncompleteTodos(mockClient as any, "session-1");
        expect(result).toBe(false);
    });
});

describe("os-notify/notifier", () => {
    beforeEach(() => {
        mockExec.mockClear();
        mockResolveCommandPath.mockReset();
    });

    it("should use AppleScript with 'Glass' sound for macOS", async () => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        mockResolveCommandPath.mockResolvedValue("/usr/bin/osascript");

        await sendNotification(PLATFORM.DARWIN, "Title", "Message");
        expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('sound name "Glass"'));
        expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('display notification "Message"'));
    });

    it("should use notify-send for Linux", async () => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        mockResolveCommandPath.mockResolvedValue("/usr/bin/notify-send");

        await sendNotification(PLATFORM.LINUX, "Title", "Msg");
        expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('/usr/bin/notify-send "Title" "Msg"'));
    });

    it("should use powershell for Windows Toast", async () => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        mockResolveCommandPath.mockResolvedValue("powershell.exe");

        await sendNotification(PLATFORM.WIN32, "Title", "Msg");
        expect(mockExec).toHaveBeenCalledWith(expect.stringContaining("powershell.exe"));
        expect(mockExec).toHaveBeenCalledWith(expect.stringContaining("ToastNotificationManager"));
    });
});

describe("os-notify/sound-player", () => {
    beforeEach(() => {
        mockExec.mockClear();
        mockResolveCommandPath.mockReset();
    });

    it("should skip Darwin/Linux sound if path is empty", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        await playSound(PLATFORM.DARWIN, "");
        expect(mockExec).not.toHaveBeenCalled();

        await playSound(PLATFORM.LINUX, "");
        expect(mockExec).not.toHaveBeenCalled();
    });

    it("should use built-in Asterisk sound for Windows if path is empty", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        mockResolveCommandPath.mockResolvedValue("powershell.exe");

        await playSound(PLATFORM.WIN32, "");
        expect(mockExec).toHaveBeenCalledWith(expect.stringContaining("[System.Media.SystemSounds]::Asterisk.Play()"));
    });
});

describe("os-notify/handler activity tracking", () => {
    beforeEach(() => {
        vi.mocked(isSessionRecovering).mockReturnValue(false);
        mockGetTasksByParent.mockReturnValue([]);
    });

    it("should track activity for expanded event types", async () => {
        const { createSessionNotificationHandler } = await import("../../src/core/notification/os-notify/handler");
        const mockClient = { session: { todo: vi.fn() } };
        const handler = createSessionNotificationHandler(mockClient as any);

        const events = ["session.compacted", "session.error", "message.deleted"];
        for (const type of events) {
            await handler.handleEvent({ type, properties: { sessionID: "s1" } });
            expect(handler.getState().sessionActivitySinceIdle.has("s1")).toBe(true);
        }
    });

    it("should respect versioning after async calls", async () => {
        vi.useFakeTimers();
        const { createSessionNotificationHandler } = await import("../../src/core/notification/os-notify/handler");

        // Mock hasIncompleteTodos for this specific sub-test
        vi.mocked(hasIncompleteTodos).mockImplementation(() => new Promise(r => setTimeout(() => r(false), 200)));
        mockGetTasksByParent.mockReturnValue([]);

        const mockClient = { session: { todo: vi.fn() } };
        const handler = createSessionNotificationHandler(mockClient as any);

        await handler.handleEvent({ type: "session.idle", properties: { sessionID: "s1" } });
        vi.advanceTimersByTime(1500); // Trigger execute

        // New activity while execute is "thinking"
        await handler.handleEvent({ type: "message.created", properties: { info: { sessionID: "s1" } } });

        vi.advanceTimersByTime(1000); // Finish todo check

        expect(handler.getState().notifiedSessions.has("s1")).toBe(false);
        vi.useRealTimers();
    });
});

describe("os-notify/handler background checks", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.mocked(isSessionRecovering).mockReturnValue(false);
        mockGetTasksByParent.mockReturnValue([]);
        vi.mocked(hasIncompleteTodos).mockResolvedValue(false);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should skip notification if session is recovering", async () => {
        const { createSessionNotificationHandler } = await import("../../src/core/notification/os-notify/handler");
        const mockClient = { session: { todo: vi.fn() } };
        const handler = createSessionNotificationHandler(mockClient as any);

        vi.mocked(isSessionRecovering).mockReturnValue(true);

        await handler.handleEvent({ type: "session.idle", properties: { sessionID: "s1" } });
        vi.advanceTimersByTime(2000); // Wait for idle confirmation

        expect(handler.getState().notifiedSessions.has("s1")).toBe(false);
    });

    it("should skip notification if background tasks are running", async () => {
        const { createSessionNotificationHandler } = await import("../../src/core/notification/os-notify/handler");
        const mockClient = { session: { todo: vi.fn() } };
        const handler = createSessionNotificationHandler(mockClient as any);

        mockGetTasksByParent.mockReturnValue([{ status: "running" }]);

        await handler.handleEvent({ type: "session.idle", properties: { sessionID: "s1" } });
        vi.advanceTimersByTime(2000);

        expect(handler.getState().notifiedSessions.has("s1")).toBe(false);
    });

    it("should proceed if everything is clear", async () => {
        const { createSessionNotificationHandler } = await import("../../src/core/notification/os-notify/handler");
        const mockClient = { session: { todo: vi.fn() } };
        const handler = createSessionNotificationHandler(mockClient as any, { playSound: false });

        mockGetTasksByParent.mockReturnValue([]);
        vi.mocked(isSessionRecovering).mockReturnValue(false);

        await handler.handleEvent({ type: "session.idle", properties: { sessionID: "s1" } });

        // Trigger timer
        vi.advanceTimersByTime(2000);

        // Allow async executeNotification to proceed past await points
        await Promise.resolve();
        await new Promise(process.nextTick);

        expect(handler.getState().notifiedSessions.has("s1")).toBe(true);
    });
});
