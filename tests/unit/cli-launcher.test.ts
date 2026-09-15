import { describe, expect, it, vi } from "vitest";
import { launchBundledCli, signalExitCode } from "../../src/cli.js";

describe("bundled CLI launcher", () => {
    it("forwards arguments and the inherited terminal without a shell", () => {
        const spawn = vi.fn(() => ({ status: 0, signal: null }));

        const exitCode = launchBundledCli(["shell-listener", "--port", "4444"], {
            exists: () => true,
            resolveBinary: () => "/package/bin/orchestrator-linux-x64",
            spawn,
            reportError: vi.fn(),
        });

        expect(exitCode).toBe(0);
        expect(spawn).toHaveBeenCalledWith(
            "/package/bin/orchestrator-linux-x64",
            ["shell-listener", "--port", "4444"],
            expect.objectContaining({ stdio: "inherit", shell: false }),
        );
    });

    it("reports a missing platform artifact without trying to spawn", () => {
        const spawn = vi.fn();
        const reportError = vi.fn();

        const exitCode = launchBundledCli([], {
            exists: () => false,
            resolveBinary: () => "/package/bin/orchestrator-macos-arm64",
            spawn,
            reportError,
        });

        expect(exitCode).toBe(1);
        expect(spawn).not.toHaveBeenCalled();
        expect(reportError).toHaveBeenCalledWith(
            expect.stringContaining("Bundled binary not found: /package/bin/orchestrator-macos-arm64"),
        );
    });

    it("turns child process failures and signals into truthful exit codes", () => {
        const reportError = vi.fn();
        const failed = launchBundledCli([], {
            exists: () => true,
            resolveBinary: () => "orchestrator",
            spawn: () => ({ status: null, signal: null, error: new Error("spawn failed") }),
            reportError,
        });
        const signaled = launchBundledCli([], {
            exists: () => true,
            resolveBinary: () => "orchestrator",
            spawn: () => ({ status: null, signal: "SIGTERM" }),
            reportError,
        });

        expect(failed).toBe(1);
        expect(reportError).toHaveBeenCalledWith(expect.stringContaining("spawn failed"));
        expect(signaled).toBe(signalExitCode("SIGTERM"));
        expect(signaled).toBe(143);
    });
});
