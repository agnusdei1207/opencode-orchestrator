import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { platform, arch } from "os";
import { existsSync } from "fs";
import { PLATFORM } from "../shared/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

type BinaryPathOptions = {
    moduleDir?: string;
    os?: string;
    cpu?: string;
    exists?: (path: string) => boolean;
};

export function getPlatformBinaryName(os: string = platform(), cpu: string = arch()): string {
    if (os === PLATFORM.WIN32) {
        return "orchestrator-windows-x64.exe";
    }

    if (os === PLATFORM.DARWIN) {
        return cpu === "arm64" ? "orchestrator-macos-arm64" : "orchestrator-macos-x64";
    }

    return cpu === "arm64" ? "orchestrator-linux-arm64" : "orchestrator-linux-x64";
}

export function getCandidateBinDirs(moduleDir: string = __dirname): string[] {
    return [
        join(moduleDir, "..", "bin"),
        join(moduleDir, "..", "..", "bin"),
    ];
}

export function resolveBinaryPath(options: BinaryPathOptions = {}): string {
    const moduleDir = options.moduleDir ?? __dirname;
    const os = options.os ?? platform();
    const cpu = options.cpu ?? arch();
    const exists = options.exists ?? existsSync;
    const binaryName = getPlatformBinaryName(os, cpu);

    for (const binDir of getCandidateBinDirs(moduleDir)) {
        const binaryPath = join(binDir, binaryName);
        if (exists(binaryPath)) {
            return binaryPath;
        }
    }

    const fallbackName = os === PLATFORM.WIN32 ? "orchestrator.exe" : "orchestrator";
    for (const binDir of getCandidateBinDirs(moduleDir)) {
        const fallbackPath = join(binDir, fallbackName);
        if (exists(fallbackPath)) {
            return fallbackPath;
        }
    }

    return join(getCandidateBinDirs(moduleDir)[0], binaryName);
}

export function getBinaryPath(): string {
    return resolveBinaryPath();
}
