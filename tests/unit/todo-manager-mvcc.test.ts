/**
 * TodoManager MVCC Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { TodoManager } from "../../src/core/todo/todo-manager";

describe("TodoManager (MVCC)", () => {
    let testDir: string;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), "todo-test-"));
        // Create initial todo file
        fs.mkdirSync(path.join(testDir, ".opencode"), { recursive: true });
        fs.writeFileSync(path.join(testDir, ".opencode/todo.md"), "# Initial TODO\n- [ ] Task 1");
    });

    afterEach(() => {
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("should read initial version as 0 if version file missing", async () => {
        const manager = TodoManager.getInstance(testDir);
        const data = await manager.readWithVersion();
        expect(data.version.version).toBe(0);
        expect(data.content).toContain("Task 1");
    });

    it("should update version and content on successful update", async () => {
        const manager = TodoManager.getInstance(testDir);
        const result = await manager.update(0, (content) => content + "\n- [ ] Task 2", "agent-1");

        expect(result.success).toBe(true);
        expect(result.currentVersion).toBe(1);

        const data = await manager.readWithVersion();
        expect(data.version.version).toBe(1);
        expect(data.content).toContain("Task 2");
    });

    it("should fail and report conflict if version mismatch", async () => {
        const manager = TodoManager.getInstance(testDir);

        // Concurrent read
        const data1 = await manager.readWithVersion(); // v0
        const data2 = await manager.readWithVersion(); // v0

        // Agent 1 updates first
        await manager.update(data1.version.version, (c) => c + "\nBy Agent 1", "agent-1");

        // Agent 2 attempts update with old version
        const result2 = await manager.update(data2.version.version, (c) => c + "\nBy Agent 2", "agent-2");

        expect(result2.success).toBe(false);
        expect(result2.conflict).toBe(true);
        expect(result2.currentVersion).toBe(1);
    });

    it("should support concurrent updates with retry-like logic in application", async () => {
        const manager = TodoManager.getInstance(testDir);

        // Simulation of multiple agents
        const updateTask = async (name: string) => {
            for (let i = 0; i < 10; i++) { // Increased retries
                const data = await manager.readWithVersion();
                const result = await manager.update(data.version.version, (c) => c + `\n- [ ] ${name}`, name);
                if (result.success) return true;
                // Wait small random time to reduce collision (jitter)
                await new Promise(r => setTimeout(r, Math.random() * 100));
            }
            return false;
        };

        const results = await Promise.all([
            updateTask("AgentA"),
            updateTask("AgentB"),
            updateTask("AgentC")
        ]);

        expect(results.every(r => r === true)).toBe(true);

        const final = await manager.readWithVersion();
        expect(final.version.version).toBe(3);
        expect(final.content).toContain("AgentA");
        expect(final.content).toContain("AgentB");
        expect(final.content).toContain("AgentC");
    });

    it("should update item status via updateItem helper", async () => {
        const manager = TodoManager.getInstance(testDir);
        const success = await manager.updateItem("Task 1", "completed", "reviewer");

        expect(success).toBe(true);
        const data = await manager.readWithVersion();
        expect(data.content).toContain("- [x] Task 1");
        expect(data.version.version).toBe(1);
    });
});
