import { spawn } from "child_process";
import { existsSync } from "fs";
import { getBinaryPath } from "../utils/binary.js";
import { log } from "../core/agents/logger.js";

export async function callRustTool(name: string, args: Record<string, unknown>): Promise<string> {
    const binary = getBinaryPath();
    if (!existsSync(binary)) {
        return JSON.stringify({ error: `Binary not found: ${binary}` });
    }

    return new Promise((resolve) => {
        const proc = spawn(binary, ["serve"], { stdio: ["pipe", "pipe", "pipe"] });
        let stdout = "";

        proc.stdout.on("data", (data) => { stdout += data.toString(); });
        proc.stderr.on("data", (data) => {
            const msg = data.toString().trim();
            if (msg) log(`[rust-stderr] ${msg}`);
        });

        const request = JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "tools/call",
            params: { name, arguments: args },
        });

        proc.stdin.write(request + "\n");
        proc.stdin.end();

        const timeout = setTimeout(() => { proc.kill(); resolve(JSON.stringify({ error: "Timeout" })); }, 60000);

        proc.on("close", (code) => {
            clearTimeout(timeout);
            if (code !== 0 && code !== null) {
                log(`Rust process exited with code ${code}`);
            }
            try {
                // Return the last line that looks like valid JSON with expected structure
                const lines = stdout.trim().split("\n");
                for (let i = lines.length - 1; i >= 0; i--) {
                    try {
                        const response = JSON.parse(lines[i]);
                        if (response.result || response.error) {
                            const text = response?.result?.content?.[0]?.text;
                            return resolve(text || JSON.stringify(response.result));
                        }
                    } catch { continue; }
                }
                resolve(stdout || "No output");
            } catch {
                resolve(stdout || "No output");
            }
        });
    });
}
