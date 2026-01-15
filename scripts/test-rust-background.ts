/**
 * Test script for Rust Background Task Manager
 * 
 * Tests the Rust-native background task implementation via the CLI
 * 
 * Run with: npx tsx scripts/test-rust-background.ts
 */

import { spawn } from "child_process";
import { existsSync, readFileSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const BINARY_PATH = "./target/release/orchestrator";
const STATE_DIR = join(tmpdir(), "opencode-orchestrator");
const STATE_FILE = join(STATE_DIR, "bg_tasks.json");

interface BackgroundTask {
    id: string;
    command: string;
    status: string;
    output: string;
    error_output: string;
    exit_code: number | null;
}

interface TaskState {
    tasks: Record<string, BackgroundTask>;
}

function callRustTool(name: string, args: Record<string, unknown>): Promise<string> {
    return new Promise((resolve, reject) => {
        const proc = spawn(BINARY_PATH, ["serve"], {
            stdio: ["pipe", "pipe", "pipe"],
            cwd: process.cwd()
        });

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (data) => { stdout += data.toString(); });
        proc.stderr.on("data", (data) => { stderr += data.toString(); });

        const request = JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name, arguments: args },
        });

        proc.stdin.write(request + "\n");
        proc.stdin.end();

        const timeout = setTimeout(() => {
            proc.kill();
            reject(new Error("Timeout"));
        }, 10000);

        proc.on("close", () => {
            clearTimeout(timeout);
            try {
                const lines = stdout.trim().split("\n");
                const response = JSON.parse(lines[lines.length - 1]);
                const text = response?.result?.content?.[0]?.text;
                resolve(text || JSON.stringify(response.result));
            } catch (e) {
                reject(new Error(`Parse error: ${stdout}\nStderr: ${stderr}`));
            }
        });
    });
}

function readStateFile(): TaskState | null {
    if (!existsSync(STATE_FILE)) {
        return null;
    }
    const content = readFileSync(STATE_FILE, "utf-8");
    return JSON.parse(content);
}

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log("🦀 Testing Rust Background Task Manager\n");
    console.log("=".repeat(60));

    // Clean up state file
    if (existsSync(STATE_FILE)) {
        rmSync(STATE_FILE);
    }
    mkdirSync(STATE_DIR, { recursive: true });

    // Test 1: Run a quick command
    console.log("\n📋 Test 1: Run background command via Rust CLI");
    try {
        const result1 = await callRustTool("run_background", {
            command: "echo 'Hello from Rust!'",
            label: "Rust Test"
        });
        console.log("   Result:", result1.substring(0, 200) + "...");

        // Extract task ID
        const match = result1.match(/`(bg_[a-f0-9]+)`/);
        if (match) {
            const taskId = match[1];
            console.log(`   Task ID: ${taskId}`);

            // Wait for completion
            await sleep(500);

            // Check state file directly
            console.log("\n📋 Test 2: Check state file");
            const state = readStateFile();
            if (state && state.tasks[taskId]) {
                const task = state.tasks[taskId];
                console.log(`   Status: ${task.status}`);
                console.log(`   Output: ${task.output.trim()}`);
                console.log(`   Exit code: ${task.exit_code}`);
            } else {
                console.log("   ⚠️ Task not found in state file (process may have exited before writing)");
            }
        }
    } catch (e) {
        console.log(`   Error: ${e}`);
    }

    // Test 3: List tasks
    console.log("\n📋 Test 3: List background tasks");
    try {
        const result3 = await callRustTool("list_background", {});
        console.log("   Result:", result3.substring(0, 300) + "...");
    } catch (e) {
        console.log(`   Error: ${e}`);
    }

    // Test 4: State file contents
    console.log("\n📋 Test 4: State file contents");
    const finalState = readStateFile();
    if (finalState) {
        console.log(`   Total tasks: ${Object.keys(finalState.tasks).length}`);
        for (const [id, task] of Object.entries(finalState.tasks)) {
            console.log(`   - ${id}: ${task.status} - ${task.command.substring(0, 30)}`);
        }
    } else {
        console.log("   No state file found");
    }

    console.log("\n" + "=".repeat(60));
    console.log("✨ Rust background test complete!\n");
    console.log("Note: Due to the request-response nature of 'orchestrator serve',");
    console.log("      the background thread may not complete before the process exits.");
    console.log("      In production, the OpenCode plugin maintains state in TypeScript");
    console.log("      while Rust handles the actual command execution.\n");
}

main().catch(console.error);
