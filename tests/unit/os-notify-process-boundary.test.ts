import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLATFORM } from "../../src/shared/os/index.js";

const processMocks = vi.hoisted(() => {
    const invokeCallback = (args: unknown[]) => {
        const callback = args.findLast(value => typeof value === "function") as
            | ((error: Error | null, stdout?: string, stderr?: string) => void)
            | undefined;
        callback?.(null, "", "");
        return { on: vi.fn() };
    };
    return {
        exec: vi.fn((...args: unknown[]) => invokeCallback(args)),
        execFile: vi.fn((...args: unknown[]) => invokeCallback(args)),
    };
});

vi.mock("node:child_process", () => processMocks);
vi.mock("node:util", () => ({
    promisify: (fn: (...args: unknown[]) => unknown) => (...args: unknown[]) =>
        new Promise((resolve, reject) => {
            fn(...args, (error: Error | null, stdout = "", stderr = "") => {
                if (error) reject(error);
                else resolve({ stdout, stderr });
            });
        }),
}));
vi.mock("../../src/core/notification/os-notify/platform-resolver.js", () => ({
    resolveCommandPath: vi.fn().mockResolvedValue("/usr/bin/notify-send"),
}));
vi.mock("../../src/core/agents/logger.js", () => ({ log: vi.fn() }));

describe("OS notification process boundary", () => {
    beforeEach(() => {
        processMocks.exec.mockClear();
        processMocks.execFile.mockClear();
    });

    it("passes notification text as argv without invoking a shell", async () => {
        const { sendNotification } = await import("../../src/core/notification/os-notify/notifier.js");
        const title = 'title"; touch /tmp/owned; #';
        const message = "$(touch /tmp/owned)\nsecond line; & whoami";

        await sendNotification(PLATFORM.LINUX, title, message);

        expect(processMocks.exec).not.toHaveBeenCalled();
        expect(processMocks.execFile).toHaveBeenCalledWith(
            "/usr/bin/notify-send",
            [title, message],
            expect.objectContaining({ windowsHide: true }),
            expect.any(Function),
        );
    });

    it("passes sound paths as argv without invoking a shell", async () => {
        const { playSound } = await import("../../src/core/notification/os-notify/sound-player.js");
        const soundPath = 'alert"; touch /tmp/owned; #.wav';

        await playSound(PLATFORM.LINUX, soundPath);

        expect(processMocks.exec).not.toHaveBeenCalled();
        expect(processMocks.execFile).toHaveBeenCalledWith(
            "/usr/bin/notify-send",
            [soundPath],
            expect.objectContaining({ windowsHide: true }),
            expect.any(Function),
        );
    });
});
