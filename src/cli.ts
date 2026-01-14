#!/usr/bin/env node
import { spawn } from "child_process";
import { existsSync } from "fs";
import { platform, arch } from "os";
import { getBinaryPath } from "./utils/binary.js";

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
