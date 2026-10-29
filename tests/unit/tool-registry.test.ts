import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Plugin } from "@opencode/plugin";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerAllTools } from "../../src/tools/registry.js";
import { registerTools } from "../../src/host/tool-adapter.js";
import { TOOL_NAMES } from "../../src/shared/index.js";

type RegisteredTool = {
    name: string;
    options?: unknown;
    description: string;
    input: { properties?: Record<string, unknown>; required?: string[] };
    execute: (input: unknown, context: Record<string, unknown>) => Promise<{ content: string }>;
};

describe("registerAllTools", () => {
    it("returns exactly one tool, update_todo", () => {
        const tools = registerAllTools();
        expect(Object.keys(tools)).toEqual([TOOL_NAMES.UPDATE_TODO]);
        expect(TOOL_NAMES.UPDATE_TODO).toBe("update_todo");
    });

    it("leaves delegation, shell, search and web capabilities to the host's native tools", () => {
        const tools = registerAllTools();
        for (const name of [
            "delegate_task", "get_task_result", "list_tasks", "cancel_task", "list_agents", "show_metrics",
            "run_background", "check_background", "list_background", "kill_background",
            "grep_search", "glob_search", "webfetch", "websearch", "subagent", "shell",
        ]) {
            expect(tools).not.toHaveProperty(name);
        }
    });
});

describe("host tool adapter", () => {
    const directories: string[] = [];

    afterEach(() => {
        for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
    });

    async function register(directory: string) {
        const added: RegisteredTool[] = [];
        const dispose = vi.fn();
        const context = {
            location: { directory, project: { directory } },
            tool: {
                transform: vi.fn(async (edit: (editor: { add: (tool: RegisteredTool) => void }) => void) => {
                    edit({ add: tool => added.push(tool) });
                    return { dispose };
                }),
            },
        } as unknown as Plugin.Context;
        const registration = await registerTools(context, registerAllTools());
        return { added, registration, dispose };
    }

    it("registers update_todo with codemode disabled so it is directly callable", async () => {
        const directory = mkdtempSync(join(tmpdir(), "tool-registry-"));
        directories.push(directory);

        const { added } = await register(directory);

        expect(added).toHaveLength(1);
        expect(added[0].name).toBe("update_todo");
        expect(added[0].options).toEqual({ codemode: false });
        expect(Object.keys(added[0].input.properties ?? {}).sort()).toEqual(["action", "status", "subtask", "task"]);
        expect(added[0].input.required?.sort()).toEqual(["action", "task"]);
    });

    it("runs the tool against the plugin's directory and wraps the text result as content", async () => {
        const directory = mkdtempSync(join(tmpdir(), "tool-registry-run-"));
        directories.push(directory);
        mkdirSync(join(directory, ".opencode"), { recursive: true });
        writeFileSync(join(directory, ".opencode", "todo.md"), "- [ ] Ship it");
        const { added } = await register(directory);

        const result = await added[0].execute(
            { action: "update", task: "Ship it", status: "completed" },
            { sessionID: "s1", messageID: "m1", agent: "Worker", signal: new AbortController().signal },
        );

        expect(result.content).toContain('Updated task status: "Ship it" -> completed');
        expect(readFileSync(join(directory, ".opencode", "todo.md"), "utf8")).toBe("- [x] Ship it");
    });
});
