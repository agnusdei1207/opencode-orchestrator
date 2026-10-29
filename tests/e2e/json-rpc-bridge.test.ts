/**
 * JSON-RPC Bridge E2E Tests
 * 
 * Verifies the actual communication between TypeScript and the Rust binary:
 * - Spawns the Rust process in 'serve' mode
 * - Sends a tools/call request via stdin
 * - Receives and parses a JSON-RPC response via stdout
 * - Verifies that stderr logs are correctly generated
 */

import { describe, it, expect } from "vitest";
import { spawn } from "child_process";
import { getBinaryPath } from "../../src/utils/binary.js";
import { existsSync } from "fs";
import { dirname } from "path";

// Resolve at module level so a missing binary shows up as skipped tests.
const binaryPath = getBinaryPath();
const hasBinary = existsSync(binaryPath);

describe.skipIf(!hasBinary)("JSON-RPC Bridge (Rust <-> TS)", () => {
    it("should respond to file_stats via JSON-RPC and write logs to stderr", async () => {
        const binaryDir = dirname(binaryPath);

        const res = await new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
            const proc = spawn(binaryPath, ["serve"], {
                env: { ...process.env, RUST_LOG: "info" }
            });
            let stdout = "";
            let stderr = "";

            proc.stdout.on("data", (data) => {
                stdout += data.toString();
                if (stdout.includes("\n")) {
                    proc.kill();
                }
            });

            proc.stderr.on("data", (data) => {
                stderr += data.toString();
            });

            const request = {
                jsonrpc: "2.0",
                id: 1,
                method: "tools/call",
                params: {
                    name: "file_stats",
                    arguments: { directory: binaryDir }
                }
            };

            proc.stdin.write(JSON.stringify(request) + "\n");

            setTimeout(() => {
                proc.kill();
                reject(new Error("Timeout waiting for Rust response"));
            }, 5000);

            proc.on("close", () => {
                resolve({ stdout, stderr });
            });
        });

        // Parse response
        const response = JSON.parse(res.stdout.trim());
        expect(response.jsonrpc).toBe("2.0");
        expect(response.id).toBe(1);

        // Verify logs on stderr
        expect(res.stderr).toContain("OpenCode Orchestrator starting");

        const stats = JSON.parse(response.result.content[0].text);
        // The binary itself lives in the analyzed directory.
        expect(stats.total_files).toBeGreaterThanOrEqual(1);
        expect(typeof stats.total_size_bytes).toBe("number");
        expect(Array.isArray(stats.file_types)).toBe(true);
    });

    it("should handle error for unknown tool", async () => {
        const result = await new Promise<string>((resolve) => {
            const proc = spawn(binaryPath, ["serve"]);
            let stdout = "";

            proc.stdout.on("data", (data) => {
                stdout += data.toString();
                if (stdout.includes("\n")) proc.kill();
            });

            const request = {
                jsonrpc: "2.0",
                id: 99,
                method: "tools/call",
                params: {
                    name: "unknown_tool_xyz",
                    arguments: {}
                }
            };

            proc.stdin.write(JSON.stringify(request) + "\n");
            proc.on("close", () => resolve(stdout));
        });

        const response = JSON.parse(result.trim());
        expect(response.id).toBe(99);
        expect(response.result.content[0].text).toContain("Unknown tool");
    });
});
