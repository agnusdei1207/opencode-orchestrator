/**
 * OS Native Notification Tests
 * 
 * Comprehensive tests for the os-notify system.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectPlatform, getDefaultSoundPath } from "../../src/core/notification/os-notify/platform";
import { hasIncompleteTodos } from "../../src/core/notification/os-notify/todo-checker";
import { PLATFORM } from "../../src/shared/os/index.js";
import { TODO_STATUS } from "../../src/shared/loop/index.js";

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

// Mock todo-checker (needed because we want to vary it)
vi.mock("../../src/core/notification/os-notify/todo-checker", async () => {
    const actual = await vi.importActual("../../src/core/notification/os-notify/todo-checker") as any;
    return {
        ...actual,
        hasIncompleteTodos: vi.fn(actual.hasIncompleteTodos),
    };
});

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
        // Use the actual implementation (which is what hasIncompleteTodos normally is before being mocked)
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
