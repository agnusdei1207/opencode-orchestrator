import { beforeEach, describe, expect, it, vi } from "vitest";
import { log } from "../../src/core/agents/logger.js";
import { NOTIFICATION_COMMAND_KEYS } from "../../src/shared/notification/os-notify/index.js";

const processMocks = vi.hoisted(() => ({
    execFile: vi.fn(),
}));

vi.mock("node:child_process", () => ({ execFile: processMocks.execFile }));
vi.mock("../../src/core/agents/logger.js", () => ({ log: vi.fn() }));

describe("platform command resolver", () => {
    beforeEach(() => {
        processMocks.execFile.mockReset();
        vi.mocked(log).mockClear();
    });

    it("looks up fixed command names without a shell and normalizes CRLF output", async () => {
        processMocks.execFile.mockImplementation((
            _file: string,
            _args: string[],
            _options: object,
            callback: (error: Error | null, stdout: string, stderr: string) => void,
        ) => {
            callback(null, "C:\\tools\\node.exe\r\nC:\\other\\node.exe\r\n", "");
            return { on: vi.fn() };
        });
        const { resolveCommandPath } = await import("../../src/core/notification/os-notify/platform-resolver");

        const path = await resolveCommandPath(NOTIFICATION_COMMAND_KEYS.OSASCRIPT, "node");

        expect(path).toBe("C:\\tools\\node.exe");
        expect(processMocks.execFile).toHaveBeenCalledWith(
            expect.stringMatching(/^(where|which)$/),
            ["node"],
            expect.objectContaining({ encoding: "utf8", windowsHide: true }),
            expect.any(Function),
        );
        expect(log).not.toHaveBeenCalled();
    });

    it("logs lookup failures before returning null", async () => {
        processMocks.execFile.mockImplementation((
            _file: string,
            _args: string[],
            _options: object,
            callback: (error: Error) => void,
        ) => {
            callback(new Error("missing"));
            return { on: vi.fn() };
        });
        const { resolveCommandPath } = await import("../../src/core/notification/os-notify/platform-resolver");
        const commandName = "missing-opencode-command";

        const path = await resolveCommandPath(NOTIFICATION_COMMAND_KEYS.AFPLAY, commandName);

        expect(path).toBeNull();
        expect(processMocks.execFile).toHaveBeenCalledWith(
            expect.stringMatching(/^(where|which)$/),
            [commandName],
            expect.objectContaining({ windowsHide: true }),
            expect.any(Function),
        );
        expect(log).toHaveBeenCalledWith(expect.stringContaining(`Command lookup failed for ${commandName}`));
    });

    it("caches a missing command instead of spawning a lookup for every notification", async () => {
        processMocks.execFile.mockImplementation((
            _file: string,
            _args: string[],
            _options: object,
            callback: (error: Error) => void,
        ) => {
            callback(new Error("missing"));
            return { on: vi.fn() };
        });
        const { resolveCommandPath } = await import("../../src/core/notification/os-notify/platform-resolver");

        await expect(resolveCommandPath(NOTIFICATION_COMMAND_KEYS.PAPLAY, "missing-paplay")).resolves.toBeNull();
        await expect(resolveCommandPath(NOTIFICATION_COMMAND_KEYS.PAPLAY, "missing-paplay")).resolves.toBeNull();

        expect(processMocks.execFile).toHaveBeenCalledOnce();
    });
});
