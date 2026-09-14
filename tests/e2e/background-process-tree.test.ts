import { setTimeout as delay } from "node:timers/promises";
import { expect, it } from "vitest";
import { backgroundTaskManager } from "../../src/core/commands/manager";

it("terminates the owned shell, node child, and grandchild before confirming kill", async () => {
    const program = `const {spawn}=require('node:child_process'); const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); console.log(JSON.stringify({root:process.pid,child:child.pid})); setInterval(()=>{},1000);`;
    const encoded = Buffer.from(program).toString("base64");
    const task = backgroundTaskManager.run({
        command: `${process.platform === "win32" ? "call " : ""}"${process.execPath}" -e "eval(Buffer.from('${encoded}','base64').toString())"`,
        timeout: 10_000,
    });
    const pids: number[] = task.process?.pid ? [task.process.pid] : [];
    try {
        for (let attempt = 0; attempt < 100 && !task.output.includes("child"); attempt++) await delay(20);
        expect(task.output, task.errorOutput).toContain("child");
        const descendants = JSON.parse(task.output.trim()) as { root: number; child: number };
        pids.push(descendants.root, descendants.child);
        expect(await backgroundTaskManager.kill(task.id)).toBe(true);
        for (let attempt = 0; attempt < 100 && pids.some(isRunning); attempt++) await delay(20);
        expect(pids.filter(isRunning)).toEqual([]);
        expect(task.process).toBeUndefined();
    } finally {
        for (const pid of pids) {
            try { process.kill(pid, "SIGKILL"); } catch { /* already terminated */ }
        }
        await backgroundTaskManager.shutdown();
    }
}, 10_000);

function isRunning(pid: number): boolean {
    try { process.kill(pid, 0); return true; } catch { return false; }
}
