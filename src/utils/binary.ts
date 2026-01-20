import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { platform, arch } from "os";
import { existsSync } from "fs";
import { PLATFORM } from "../shared/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getBinaryPath(): string {
    // __dirname is src/utils, so we need to go up two levels to get to root
    const binDir = join(__dirname, "..", "..", "bin");
    const os = platform();
    const cpu = arch();

    let binaryName: string;
    if (os === PLATFORM.WIN32) {
        binaryName = "orchestrator-windows-x64.exe";
    } else if (os === PLATFORM.DARWIN) {
        binaryName = cpu === "arm64" ? "orchestrator-macos-arm64" : "orchestrator-macos-x64";
    } else {
        binaryName = cpu === "arm64" ? "orchestrator-linux-arm64" : "orchestrator-linux-x64";
    }

    let binaryPath = join(binDir, binaryName);
    if (!existsSync(binaryPath)) {
        binaryPath = join(binDir, os === PLATFORM.WIN32 ? "orchestrator.exe" : "orchestrator");
    }

    return binaryPath;
}
