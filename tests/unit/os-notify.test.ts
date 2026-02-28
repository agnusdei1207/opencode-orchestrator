/**
 * OS Native Notification Tests
 *
 * Full scenario coverage for:
 *   - platform detection
 *   - todo-checker
 *   - notifier (all platforms, edge cases, WSL2)
 *   - sound-player (all platforms, empty path, real path, fallback)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectPlatform, getDefaultSoundPath } from "../../src/core/notification/os-notify/platform";
import { hasIncompleteTodos } from "../../src/core/notification/os-notify/todo-checker";
import { PLATFORM } from "../../src/shared/os/index.js";
import { TODO_STATUS } from "../../src/shared/loop/index.js";

// ---------------------------------------------------------------------------
// Global Mocks
// ---------------------------------------------------------------------------

// Mock log (suppress noise)
vi.mock("../../src/core/agents/logger.js", () => ({ log: vi.fn() }));

// Mock child_process — supports both exec(cmd, cb) and promisify(exec)(cmd)
const mockExec = vi.fn();
vi.mock("node:child_process", () => ({
    exec: vi.fn((cmd: string, cb?: Function) => {
        mockExec(cmd);
        // promisify wraps exec and passes a nodeback: exec(cmd, opts?, cb)
        if (typeof cb === "function") cb(null, "", "");
        return { on: vi.fn() };
    }),
}));

// Mock node:fs — prevents isWSL() from reading /proc/version on disk.
// Default: /proc/version throws (non-WSL). Individual tests set env vars for WSL.
vi.mock("node:fs", () => ({
    readFileSync: vi.fn((path: string) => {
        if (path === "/proc/version") throw new Error("mocked: not on disk");
        return "";
    }),
}));

// Mock node:util promisify — return a function that calls the mocked exec
// and resolves when exec calls its callback.
vi.mock("node:util", () => ({
    promisify: vi.fn((fn: Function) => {
        return (...args: any[]) =>
            new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
                fn(...args, (err: Error | null, stdout = "", stderr = "") => {
                    if (err) reject(err);
                    else resolve({ stdout, stderr });
                });
            });
    }),
}));

// Mock platform-resolver
const mockResolveCommandPath = vi.fn();
vi.mock("../../src/core/notification/os-notify/platform-resolver", () => ({
    resolveCommandPath: (key: string, name: string) => mockResolveCommandPath(key, name),
}));

// Mock deps not under test
vi.mock("../../src/core/agents/manager.js", () => ({
    ParallelAgentManager: { getInstance: vi.fn(() => ({ getTasksByParent: vi.fn() })) },
}));
vi.mock("../../src/core/recovery/session-recovery.js", () => ({ isSessionRecovering: vi.fn() }));
vi.mock("../../src/core/loop/mission-loop.js", () => ({ isLoopActive: vi.fn() }));
vi.mock("../../src/core/notification/os-notify/todo-checker", async () => {
    const actual = await vi.importActual("../../src/core/notification/os-notify/todo-checker") as any;
    return { ...actual, hasIncompleteTodos: vi.fn(actual.hasIncompleteTodos) };
});

// ---------------------------------------------------------------------------
// os-notify/platform
// ---------------------------------------------------------------------------

describe("os-notify/platform", () => {
    it("detectPlatform returns a valid platform constant", () => {
        const platform = detectPlatform();
        expect([PLATFORM.DARWIN, PLATFORM.LINUX, PLATFORM.WIN32, PLATFORM.UNSUPPORTED]).toContain(platform);
    });

    it("getDefaultSoundPath returns empty string for all OS built-ins (sound is inline)", () => {
        expect(getDefaultSoundPath(PLATFORM.DARWIN)).toBe("");
        expect(getDefaultSoundPath(PLATFORM.LINUX)).toBe("");
        expect(getDefaultSoundPath(PLATFORM.WIN32)).toBe("");
    });

    it("getDefaultSoundPath returns empty string for unsupported platform", () => {
        expect(getDefaultSoundPath(PLATFORM.UNSUPPORTED)).toBe("");
    });
});

// ---------------------------------------------------------------------------
// os-notify/todo-checker
// ---------------------------------------------------------------------------

describe("os-notify/todo-checker", () => {
    it("returns true when at least one todo is incomplete", async () => {
        const client = {
            session: {
                todo: vi.fn().mockResolvedValue({
                    data: [{ status: TODO_STATUS.COMPLETED }, { status: TODO_STATUS.PENDING }],
                }),
            },
        };
        expect(await hasIncompleteTodos(client as any, "s1")).toBe(true);
    });

    it("returns false when all todos are completed or cancelled", async () => {
        const client = {
            session: {
                todo: vi.fn().mockResolvedValue({
                    data: [{ status: TODO_STATUS.COMPLETED }, { status: TODO_STATUS.CANCELLED }],
                }),
            },
        };
        expect(await hasIncompleteTodos(client as any, "s1")).toBe(false);
    });

    it("returns false when todo list is empty", async () => {
        const client = {
            session: { todo: vi.fn().mockResolvedValue({ data: [] }) },
        };
        expect(await hasIncompleteTodos(client as any, "s1")).toBe(false);
    });

    it("returns false when client throws (fail-safe)", async () => {
        const client = {
            session: { todo: vi.fn().mockRejectedValue(new Error("network")) },
        };
        expect(await hasIncompleteTodos(client as any, "s1")).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// os-notify/notifier  — all platform branches + edge cases
// ---------------------------------------------------------------------------

describe("os-notify/notifier", () => {
    beforeEach(() => {
        mockExec.mockClear();
        mockResolveCommandPath.mockReset();
        // Ensure WSL env vars are clean unless a test sets them
        delete process.env.WSL_DISTRO_NAME;
        delete process.env.WSLENV;
    });

    // ── macOS ───────────────────────────────────────────────────────────────

    it("[darwin] calls osascript with Glass sound and redirects output", async () => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        mockResolveCommandPath.mockResolvedValue("/usr/bin/osascript");

        await sendNotification(PLATFORM.DARWIN, "Title", "Message");

        expect(mockExec).toHaveBeenCalledTimes(1);
        const cmd = mockExec.mock.calls[0][0] as string;
        expect(cmd).toContain('display notification "Message"');
        expect(cmd).toContain('sound name "Glass"');
        expect(cmd).toContain(">/dev/null 2>/dev/null");
    });

    it("[darwin] does nothing when osascript is not found", async () => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        mockResolveCommandPath.mockResolvedValue(null); // not found

        await sendNotification(PLATFORM.DARWIN, "Title", "Message");

        expect(mockExec).not.toHaveBeenCalled();
    });

    it("[darwin] escapes double quotes in title and message", async () => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        mockResolveCommandPath.mockResolvedValue("/usr/bin/osascript");

        await sendNotification(PLATFORM.DARWIN, 'Title "quoted"', 'Msg "special"');

        const cmd = mockExec.mock.calls[0][0] as string;
        expect(cmd).toContain('Title \\"quoted\\"');
        expect(cmd).toContain('Msg \\"special\\"');
    });

    // ── Linux (non-WSL) ──────────────────────────────────────────────────────

    it("[linux non-WSL] calls notify-send with stdout+stderr redirected", async () => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        mockResolveCommandPath.mockResolvedValue("/usr/bin/notify-send");

        await sendNotification(PLATFORM.LINUX, "Title", "Msg");

        expect(mockExec).toHaveBeenCalledTimes(1);
        const cmd = mockExec.mock.calls[0][0] as string;
        expect(cmd).toContain('/usr/bin/notify-send "Title" "Msg"');
        expect(cmd).toContain(">/dev/null 2>/dev/null");
    });

    it("[linux non-WSL] does nothing when notify-send is not found", async () => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        mockResolveCommandPath.mockResolvedValue(null);

        await sendNotification(PLATFORM.LINUX, "Title", "Msg");

        expect(mockExec).not.toHaveBeenCalled();
    });

    // ── Linux WSL2 ───────────────────────────────────────────────────────────

    it("[linux WSL2] skips notify-send when WSL_DISTRO_NAME is set", async () => {
        process.env.WSL_DISTRO_NAME = "Ubuntu";
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        mockResolveCommandPath.mockResolvedValue("/usr/bin/notify-send");

        await sendNotification(PLATFORM.LINUX, "Title", "Msg");

        expect(mockExec).not.toHaveBeenCalled();
        delete process.env.WSL_DISTRO_NAME;
    });

    it("[linux WSL2] skips notify-send when WSLENV is set", async () => {
        process.env.WSLENV = "PATH/l";
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        mockResolveCommandPath.mockResolvedValue("/usr/bin/notify-send");

        await sendNotification(PLATFORM.LINUX, "Title", "Msg");

        expect(mockExec).not.toHaveBeenCalled();
        delete process.env.WSLENV;
    });

    // ── Windows ──────────────────────────────────────────────────────────────

    it("[windows] calls powershell Toast and redirects output to NUL", async () => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        mockResolveCommandPath.mockResolvedValue("powershell.exe");

        await sendNotification(PLATFORM.WIN32, "Title", "Msg");

        expect(mockExec).toHaveBeenCalledTimes(1);
        const cmd = mockExec.mock.calls[0][0] as string;
        expect(cmd).toContain("powershell.exe");
        expect(cmd).toContain("ToastNotificationManager");
        expect(cmd).toContain(">NUL 2>NUL");
    });

    it("[windows] does nothing when powershell is not found", async () => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        mockResolveCommandPath.mockResolvedValue(null);

        await sendNotification(PLATFORM.WIN32, "Title", "Msg");

        expect(mockExec).not.toHaveBeenCalled();
    });

    it("[windows] escapes single quotes in title and message for PS", async () => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        mockResolveCommandPath.mockResolvedValue("powershell.exe");

        await sendNotification(PLATFORM.WIN32, "It's", "O'Reilly");

        const cmd = mockExec.mock.calls[0][0] as string;
        // Single quotes are doubled in PS: ' → ''
        expect(cmd).toContain("It''s");
        expect(cmd).toContain("O''Reilly");
    });

    // ── Unknown platform ──────────────────────────────────────────────────────

    it("[unsupported] does nothing for unknown platform", async () => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");

        await sendNotification(PLATFORM.UNSUPPORTED as any, "Title", "Msg");

        expect(mockExec).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// os-notify/sound-player — all platform branches + edge cases
// ---------------------------------------------------------------------------

describe("os-notify/sound-player", () => {
    beforeEach(() => {
        mockExec.mockClear();
        mockResolveCommandPath.mockReset();
    });

    // ── macOS ───────────────────────────────────────────────────────────────

    it("[darwin] skips exec when soundPath is empty", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        await playSound(PLATFORM.DARWIN, "");
        expect(mockExec).not.toHaveBeenCalled();
    });

    it("[darwin] calls afplay with path and redirects output", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        mockResolveCommandPath.mockResolvedValue("/usr/bin/afplay");

        await playSound(PLATFORM.DARWIN, "/sounds/alert.aiff");

        expect(mockExec).toHaveBeenCalledTimes(1);
        const cmd = mockExec.mock.calls[0][0] as string;
        expect(cmd).toContain('/usr/bin/afplay');
        expect(cmd).toContain('/sounds/alert.aiff');
        expect(cmd).toContain(">/dev/null 2>/dev/null");
    });

    it("[darwin] skips exec when afplay is not found", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        mockResolveCommandPath.mockResolvedValue(null);

        await playSound(PLATFORM.DARWIN, "/sounds/alert.aiff");

        expect(mockExec).not.toHaveBeenCalled();
    });

    // ── Linux ────────────────────────────────────────────────────────────────

    it("[linux] skips exec when soundPath is empty", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        await playSound(PLATFORM.LINUX, "");
        expect(mockExec).not.toHaveBeenCalled();
    });

    it("[linux] uses paplay when available (and redirects output)", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        // First call (paplay) resolves, second (aplay) should never be reached
        mockResolveCommandPath.mockResolvedValueOnce("/usr/bin/paplay");

        await playSound(PLATFORM.LINUX, "/sounds/alert.ogg");

        expect(mockExec).toHaveBeenCalledTimes(1);
        const cmd = mockExec.mock.calls[0][0] as string;
        expect(cmd).toContain('/usr/bin/paplay');
        expect(cmd).toContain('/sounds/alert.ogg');
        expect(cmd).toContain(">/dev/null 2>/dev/null");
    });

    it("[linux] falls back to aplay when paplay is not found", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        mockResolveCommandPath
            .mockResolvedValueOnce(null)           // paplay → not found
            .mockResolvedValueOnce("/usr/bin/aplay"); // aplay → found

        await playSound(PLATFORM.LINUX, "/sounds/alert.wav");

        expect(mockExec).toHaveBeenCalledTimes(1);
        const cmd = mockExec.mock.calls[0][0] as string;
        expect(cmd).toContain('/usr/bin/aplay');
        expect(cmd).toContain('/sounds/alert.wav');
        expect(cmd).toContain(">/dev/null 2>/dev/null");
    });

    it("[linux] skips exec when neither paplay nor aplay is found", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        mockResolveCommandPath.mockResolvedValue(null);

        await playSound(PLATFORM.LINUX, "/sounds/alert.wav");

        expect(mockExec).not.toHaveBeenCalled();
    });

    // ── Windows ──────────────────────────────────────────────────────────────

    it("[windows] uses Asterisk system sound when soundPath is empty", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        mockResolveCommandPath.mockResolvedValue("powershell.exe");

        await playSound(PLATFORM.WIN32, "");

        expect(mockExec).toHaveBeenCalledTimes(1);
        const cmd = mockExec.mock.calls[0][0] as string;
        expect(cmd).toContain("[System.Media.SystemSounds]::Asterisk.Play()");
        expect(cmd).toContain(">NUL 2>NUL");
    });

    it("[windows] uses SoundPlayer with custom sound file path", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        mockResolveCommandPath.mockResolvedValue("powershell.exe");

        await playSound(PLATFORM.WIN32, "C:\\sounds\\alert.wav");

        expect(mockExec).toHaveBeenCalledTimes(1);
        const cmd = mockExec.mock.calls[0][0] as string;
        expect(cmd).toContain("New-Object Media.SoundPlayer");
        expect(cmd).toContain("C:\\sounds\\alert.wav");
        expect(cmd).toContain(">NUL 2>NUL");
    });

    it("[windows] escapes single quotes in sound file path", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        mockResolveCommandPath.mockResolvedValue("powershell.exe");

        await playSound(PLATFORM.WIN32, "C:\\my sounds\\it's nice.wav");

        const cmd = mockExec.mock.calls[0][0] as string;
        expect(cmd).toContain("it''s nice.wav"); // single-quote PS escape
    });

    it("[windows] skips exec when powershell is not found", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        mockResolveCommandPath.mockResolvedValue(null);

        await playSound(PLATFORM.WIN32, "");

        expect(mockExec).not.toHaveBeenCalled();
    });

    // ── Unknown platform ──────────────────────────────────────────────────────

    it("[unsupported] does nothing for unknown platform", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");

        await playSound(PLATFORM.UNSUPPORTED as any, "/some/sound");

        expect(mockExec).not.toHaveBeenCalled();
    });
});
