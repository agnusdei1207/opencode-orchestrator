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

export function launchBundledCli(args: string[], options: LauncherOptions = {}): number {
    const reportError = options.reportError ?? console.error;
    const resolveBinary = options.resolveBinary ?? getBinaryPath;
    const exists = options.exists ?? existsSync;
    const spawn = options.spawn ?? ((command, commandArgs, spawnOptions) =>
        spawnSync(command, commandArgs, spawnOptions));

    let binaryPath: string;
    try {
        binaryPath = resolveBinary();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reportError(`orchestrator: ${message}`);
        return 1;
    }

    if (!exists(binaryPath)) {
        reportError(`orchestrator: Bundled binary not found: ${binaryPath}`);
        return 1;
    }

    const result = spawn(binaryPath, args, {
        stdio: "inherit",
        shell: false,
        env: process.env,
    });
    if (result.error) {
        reportError(`orchestrator: Failed to launch bundled binary: ${result.error.message}`);
        return 1;
    }
    if (result.signal) {
        return signalExitCode(result.signal);
    }
    return result.status ?? 1;
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
