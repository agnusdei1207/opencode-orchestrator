#!/usr/bin/env node
import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { platform, arch } from "os";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getBinaryPath() {
    const binDir = join(__dirname, "..", "bin");
    const os = platform();
    const cpu = arch();

    let binaryName;
    if (os === "win32") {
        binaryName = "orchestrator-windows-x64.exe";
    } else if (os === "darwin") {
        binaryName = cpu === "arm64" ? "orchestrator-macos-arm64" : "orchestrator-macos-x64";
    } else {
        binaryName = cpu === "arm64" ? "orchestrator-linux-arm64" : "orchestrator-linux-x64";
    }

    let binaryPath = join(binDir, binaryName);
    if (!existsSync(binaryPath)) {
        // Fallback to generic name if platform-specific not found
        binaryPath = join(binDir, os === "win32" ? "orchestrator.exe" : "orchestrator");
    }

    return binaryPath;
}

const binary = getBinaryPath();
const args = process.argv.slice(2);

if (!existsSync(binary)) {
    console.error(`Error: Orchestrator binary not found for your platform (${platform()} ${arch()})`);
    console.error(`Expected at: ${binary}`);
    process.exit(1);
}

const child = spawn(binary, args, { stdio: "inherit" });

child.on("close", (code) => {
    process.exit(code || 0);
});

child.on("error", (err) => {
    console.error("Failed to start orchestrator binary:", err);
    process.exit(1);
});
