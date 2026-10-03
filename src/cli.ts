#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { constants } from "node:os";
import { existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getBinaryPath } from "./utils/binary.js";

type SpawnResult = {
    status: number | null;
    signal?: string | null;
    error?: Error;
};

type LauncherOptions = {
    exists?: (path: string) => boolean;
    resolveBinary?: () => string;
    spawn?: (
        command: string,
        args: string[],
        options: { stdio: "inherit"; shell: false; env: NodeJS.ProcessEnv },
    ) => SpawnResult;
    reportError?: (message: string) => void;
};

export function signalExitCode(signal: string): number {
    const signalNumber = constants.signals[signal as keyof typeof constants.signals] ?? 1;
    return 128 + signalNumber;
}

type Launcher = Required<LauncherOptions>;

function resolveLauncher(options: LauncherOptions): Launcher {
    const reportError = options.reportError ?? console.error;
    const resolveBinary = options.resolveBinary ?? getBinaryPath;
    const exists = options.exists ?? existsSync;
    const spawn = options.spawn ?? ((command, commandArgs, spawnOptions) =>
        spawnSync(command, commandArgs, spawnOptions));
    return { reportError, resolveBinary, exists, spawn };
}

/** Returns null after reporting when the binary cannot be resolved. */
function resolveBinaryOrReport(launcher: Launcher): string | null {
    const { resolveBinary, reportError } = launcher;
    try {
        return resolveBinary();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reportError(`orchestrator: ${message}`);
        return null;
    }
}

function exitCodeFromSpawn(result: SpawnResult, reportError: Launcher["reportError"]): number {
    if (result.error) {
        reportError(`orchestrator: Failed to launch bundled binary: ${result.error.message}`);
        return 1;
    }
    if (result.signal) {
        return signalExitCode(result.signal);
    }
    return result.status ?? 1;
}

export function launchBundledCli(args: string[], options: LauncherOptions = {}): number {
    const launcher = resolveLauncher(options);
    // Call the injected functions unbound, exactly as the caller supplied them.
    const { reportError, exists, spawn } = launcher;

    const binaryPath = resolveBinaryOrReport(launcher);
    if (binaryPath === null) return 1;

    if (!exists(binaryPath)) {
        reportError(`orchestrator: Bundled binary not found: ${binaryPath}`);
        return 1;
    }

    const result = spawn(binaryPath, args, {
        stdio: "inherit",
        shell: false,
        env: process.env,
    });
    return exitCodeFromSpawn(result, reportError);
}

function isDirectExecution(): boolean {
    const argvEntry = process.argv[1];
    if (!argvEntry) return false;

    try {
        return realpathSync(argvEntry) === realpathSync(fileURLToPath(import.meta.url));
    } catch {
        return false;
    }
}

if (isDirectExecution()) {
    process.exitCode = launchBundledCli(process.argv.slice(2));
}
