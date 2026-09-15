import { beforeEach, describe, expect, it, vi } from "vitest";
import { detectPlatform, getDefaultSoundPath } from "../../src/core/notification/os-notify/platform";
import { log } from "../../src/core/agents/logger.js";
import { PLATFORM } from "../../src/shared/os/index.js";

const processMocks = vi.hoisted(() => ({
    execFile: vi.fn((...args: unknown[]) => {
        const callback = args.findLast(value => typeof value === "function") as
            | ((error: Error | null, stdout?: string, stderr?: string) => void)
            | undefined;
        callback?.(null, "", "");
        return { on: vi.fn() };
    }),
}));

vi.mock("node:child_process", () => ({ execFile: processMocks.execFile }));
vi.mock("node:fs", () => ({
    readFileSync: vi.fn((path: string) => {
        if (path === "/proc/version") throw new Error("mocked: not on disk");
        return "";
    }),
}));
vi.mock("../../src/core/agents/logger.js", () => ({ log: vi.fn() }));

const mockResolveCommandPath = vi.hoisted(() => vi.fn());
vi.mock("../../src/core/notification/os-notify/platform-resolver", () => ({
    resolveCommandPath: (key: string, name: string) => mockResolveCommandPath(key, name),
}));

describe("os-notify/platform", () => {
    it("detects a supported platform value", () => {
        expect([
            PLATFORM.DARWIN,
            PLATFORM.LINUX,
            PLATFORM.WIN32,
            PLATFORM.UNSUPPORTED,
        ]).toContain(detectPlatform());
    });

    it("uses built-in sounds unless a custom path is configured", () => {
        expect(getDefaultSoundPath(PLATFORM.DARWIN)).toBe("");
        expect(getDefaultSoundPath(PLATFORM.LINUX)).toBe("");
        expect(getDefaultSoundPath(PLATFORM.WIN32)).toBe("");
        expect(getDefaultSoundPath(PLATFORM.UNSUPPORTED)).toBe("");
    });
});

describe("os-notify/notifier", () => {
    beforeEach(() => {
        processMocks.execFile.mockClear();
        mockResolveCommandPath.mockReset();
        vi.mocked(log).mockClear();
        delete process.env.WSL_DISTRO_NAME;
        delete process.env.WSLENV;
    });

    it("passes macOS notification data as separate process arguments", async () => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        mockResolveCommandPath.mockResolvedValue("/usr/bin/osascript");

        await sendNotification(PLATFORM.DARWIN, 'Title "quoted"', "Message");

        expect(processMocks.execFile).toHaveBeenCalledOnce();
        const [executable, args, options] = processMocks.execFile.mock.calls[0];
        expect(executable).toBe("/usr/bin/osascript");
        expect(args).toEqual(expect.arrayContaining([
            "-e",
            "on run argv",
            'Title "quoted"',
            "Message",
        ]));
        expect(args).toContain('display notification (item 2 of argv) with title (item 1 of argv) sound name "Glass"');
        expect(options).toEqual(expect.objectContaining({ windowsHide: true }));
    });

    it.each([
        [PLATFORM.DARWIN, "osascript"],
        [PLATFORM.LINUX, "notify-send"],
        [PLATFORM.WIN32, "powershell"],
    ] as const)("logs and skips %s when %s is unavailable", async (platform, command) => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        mockResolveCommandPath.mockResolvedValue(null);

        await sendNotification(platform, "Title", "Message");

        expect(processMocks.execFile).not.toHaveBeenCalled();
        expect(log).toHaveBeenCalledWith(expect.stringContaining(`Command not found for ${platform} notification: ${command}`));
    });

    it("passes Linux title and message directly to notify-send", async () => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        mockResolveCommandPath.mockResolvedValue("/usr/bin/notify-send");

        await sendNotification(PLATFORM.LINUX, "Title", "Message");

        expect(processMocks.execFile).toHaveBeenCalledWith(
            "/usr/bin/notify-send",
            ["Title", "Message"],
            expect.objectContaining({ windowsHide: true }),
            expect.any(Function),
        );
    });

    it.each(["WSL_DISTRO_NAME", "WSLENV"])("skips Linux notifications when %s marks WSL", async variable => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        process.env[variable] = "set";
        mockResolveCommandPath.mockResolvedValue("/usr/bin/notify-send");

        await sendNotification(PLATFORM.LINUX, "Title", "Message");

        expect(processMocks.execFile).not.toHaveBeenCalled();
        expect(log).toHaveBeenCalledWith(expect.stringContaining("Skipping Linux notification in WSL"));
        delete process.env[variable];
    });

    it("passes Windows notification data through the child environment", async () => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");
        mockResolveCommandPath.mockResolvedValue("powershell.exe");

        await sendNotification(PLATFORM.WIN32, "It's", "O'Reilly");

        expect(processMocks.execFile).toHaveBeenCalledOnce();
        const [executable, args, options] = processMocks.execFile.mock.calls[0] as [string, string[], { env: NodeJS.ProcessEnv }];
        expect(executable).toBe("powershell.exe");
        expect(args.slice(0, 3)).toEqual(["-NoProfile", "-NonInteractive", "-Command"]);
        expect(args[3]).toContain("ToastNotificationManager");
        expect(args[3]).not.toContain("It's");
        expect(args[3]).not.toContain("O'Reilly");
        expect(options.env).toEqual(expect.objectContaining({
            OPENCODE_NOTIFICATION_TITLE: "It's",
            OPENCODE_NOTIFICATION_MESSAGE: "O'Reilly",
        }));
    });

    it("logs and skips unsupported platforms", async () => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier");

        await sendNotification(PLATFORM.UNSUPPORTED, "Title", "Message");

        expect(processMocks.execFile).not.toHaveBeenCalled();
        expect(log).toHaveBeenCalledWith(expect.stringContaining("Unsupported notification platform"));
    });
});

describe("os-notify/sound-player", () => {
    beforeEach(() => {
        processMocks.execFile.mockClear();
        mockResolveCommandPath.mockReset();
        vi.mocked(log).mockClear();
    });

    it.each([PLATFORM.DARWIN, PLATFORM.LINUX])("skips empty custom paths on %s", async platform => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        await playSound(platform, "");
        expect(processMocks.execFile).not.toHaveBeenCalled();
    });

    it("passes macOS sound paths directly to afplay", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        mockResolveCommandPath.mockResolvedValue("/usr/bin/afplay");

        await playSound(PLATFORM.DARWIN, "/sounds/alert.aiff");

        expect(processMocks.execFile).toHaveBeenCalledWith(
            "/usr/bin/afplay",
            ["/sounds/alert.aiff"],
            expect.objectContaining({ windowsHide: true }),
            expect.any(Function),
        );
    });

    it("prefers paplay on Linux", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        mockResolveCommandPath.mockResolvedValueOnce("/usr/bin/paplay");

        await playSound(PLATFORM.LINUX, "/sounds/alert.ogg");

        expect(processMocks.execFile).toHaveBeenCalledWith(
            "/usr/bin/paplay",
            ["/sounds/alert.ogg"],
            expect.objectContaining({ windowsHide: true }),
            expect.any(Function),
        );
        expect(mockResolveCommandPath).toHaveBeenCalledOnce();
    });

    it("falls back to aplay on Linux", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        mockResolveCommandPath.mockResolvedValueOnce(null).mockResolvedValueOnce("/usr/bin/aplay");

        await playSound(PLATFORM.LINUX, "/sounds/alert.wav");

        expect(processMocks.execFile).toHaveBeenCalledWith(
            "/usr/bin/aplay",
            ["/sounds/alert.wav"],
            expect.objectContaining({ windowsHide: true }),
            expect.any(Function),
        );
    });

    it("skips Linux sound when no player is installed", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        mockResolveCommandPath.mockResolvedValue(null);

        await playSound(PLATFORM.LINUX, "/sounds/alert.wav");

        expect(processMocks.execFile).not.toHaveBeenCalled();
    });

    it("uses the built-in Windows sound when no path is configured", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        mockResolveCommandPath.mockResolvedValue("powershell.exe");

        await playSound(PLATFORM.WIN32, "");

        expect(processMocks.execFile).toHaveBeenCalledWith(
            "powershell.exe",
            ["-NoProfile", "-NonInteractive", "-Command", "[System.Media.SystemSounds]::Asterisk.Play()"],
            expect.objectContaining({ windowsHide: true }),
            expect.any(Function),
        );
    });

    it("passes a custom Windows sound path through the child environment", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        mockResolveCommandPath.mockResolvedValue("powershell.exe");
        const soundPath = "C:\\my sounds\\it's nice.wav";

        await playSound(PLATFORM.WIN32, soundPath);

        const [, args, options] = processMocks.execFile.mock.calls[0] as [string, string[], { env: NodeJS.ProcessEnv }];
        expect(args[3]).toContain("$env:OPENCODE_NOTIFICATION_SOUND");
        expect(args[3]).not.toContain(soundPath);
        expect(options.env.OPENCODE_NOTIFICATION_SOUND).toBe(soundPath);
    });

    it("logs asynchronous player failures", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        processMocks.execFile.mockImplementationOnce((...args: unknown[]) => {
            const callback = args.findLast(value => typeof value === "function") as (error: Error) => void;
            callback(new Error("spawn failed"));
            return { on: vi.fn() };
        });
        mockResolveCommandPath.mockResolvedValue("/usr/bin/afplay");

        await playSound(PLATFORM.DARWIN, "/sounds/alert.aiff");

        expect(log).toHaveBeenCalledWith(expect.stringContaining("Sound player failed"));
    });

    it("does nothing on unsupported platforms", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player");
        await playSound(PLATFORM.UNSUPPORTED, "/some/sound");
        expect(processMocks.execFile).not.toHaveBeenCalled();
    });
});
