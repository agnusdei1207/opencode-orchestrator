import { spawn } from "child_process";
import { existsSync } from "fs";
import { getBinaryPath } from "../utils/binary.js";

export async function callRustTool(name: string, args: Record<string, unknown>): Promise<string> {
    const binary = getBinaryPath();
    if (!existsSync(binary)) {
        return JSON.stringify({ error: `Binary not found: ${binary}` });
    }

    return new Promise((resolve) => {
        const proc = spawn(binary, ["serve"], { stdio: ["pipe", "pipe", "pipe"] });
        let stdout = "";

        proc.stdout.on("data", (data) => { stdout += data.toString(); });

        const request = JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name, arguments: args },
        });

        proc.stdin.write(request + "\n");
        proc.stdin.end();

        const timeout = setTimeout(() => { proc.kill(); resolve(JSON.stringify({ error: "Timeout" })); }, 60000);

        proc.on("close", () => {
            clearTimeout(timeout);
            try {
                const lines = stdout.trim().split("\n");
                const response = JSON.parse(lines[lines.length - 1]);
                const text = response?.result?.content?.[0]?.text;
                resolve(text || JSON.stringify(response.result));
            } catch {
                resolve(stdout || "No output");
            }
        });
    });
}
