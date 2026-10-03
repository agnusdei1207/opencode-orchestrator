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

const PLATFORM_BINARY_NAMES = new Map<string, string>([
    ["linux-x64", "orchestrator-linux-x64"],
    ["linux-arm64", "orchestrator-linux-arm64"],
    ["darwin-x64", "orchestrator-macos-x64"],
    ["darwin-arm64", "orchestrator-macos-arm64"],
    ["win32-x64", "orchestrator-windows-x64.exe"],
]);

export function getPlatformBinaryName(os: string = platform(), cpu: string = arch()): string {
    const target = `${os}-${cpu}`;
    const binaryName = PLATFORM_BINARY_NAMES.get(target);
    if (!binaryName) {
        throw new Error(`Unsupported platform: ${target}`);
    }

    return binaryName;
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

    const binaryPath = findInBinDirs(moduleDir, binaryName, exists);
    if (binaryPath !== null) {
        return binaryPath;
    }

    const fallbackName = os === PLATFORM.WIN32 ? "orchestrator.exe" : "orchestrator";
    const fallbackPath = findInBinDirs(moduleDir, fallbackName, exists);
    if (fallbackPath !== null) {
        return fallbackPath;
    }

    return join(getCandidateBinDirs(moduleDir)[0], binaryName);
}

function findInBinDirs(moduleDir: string, fileName: string, exists: (path: string) => boolean): string | null {
    for (const binDir of getCandidateBinDirs(moduleDir)) {
        const candidate = join(binDir, fileName);
        if (exists(candidate)) {
            return candidate;
        }
    }
    return null;
}

export function getBinaryPath(): string {
    return resolveBinaryPath();
}
