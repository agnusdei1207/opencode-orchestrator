import { describe, it, expect } from "vitest";
import { createSlashcommandTool, COMMANDS } from "../../src/tools/slashCommand.js";

describe("slashCommand Tool", () => {
    const tool = createSlashcommandTool();

    it("keeps mission execution proportional and uses the retained completion schema", () => {
        const template = COMMANDS.task.template;
        expect(template).toContain("Handle small work directly");
        expect(template).toContain("status: completed");
        expect(template).toContain("pause");
        expect(template).not.toMatch(/without user intervention|Use your full capabilities/);
    });

    it("describes optional roles and a planning-only response without mandatory fanout", () => {
        expect(COMMANDS.plan.template).toContain("proportional");
        expect(COMMANDS.plan.template).toContain("Do not implement");
        expect(COMMANDS.agents.template).toContain("optional");
        expect(COMMANDS.agents.template).not.toMatch(/50 Worker|caches official|automatically coordinates all/);
        expect(COMMANDS.plan.template).not.toContain("Maximize parallelism");
    });

    it("returns command list when called without command name", async () => {
        const result = await (tool as any).execute({ command: "" });
        expect(result).toContain("Commands:");
        expect(result).toContain("/task");
        expect(result).toContain("/plan");
        expect(result).toContain("/agents");
    });

    it("returns unknown command notice when command is invalid", async () => {
        const result = await (tool as any).execute({ command: "foo" });
        expect(result).toContain("Unknown command: /foo");
        expect(result).toContain("- /task");
    });

    it("executes /task command and substitutes arguments correctly", async () => {
        const result = await (tool as any).execute({ command: "/task ship the feature" });
        expect(result).toContain("<mission>");
        expect(result).toContain("<task>\nship the feature\n</task>");
        expect(result).not.toContain("$ARGUMENTS");
    });

    it("executes /plan command and substitutes arguments correctly", async () => {
        const result = await (tool as any).execute({ command: "plan design architecture" });
        expect(result).toContain("<delegate>");
        expect(result).toContain("design architecture");
        expect(result).not.toContain("$ARGUMENTS");
        expect(result).not.toContain("plan design");
    });

    it("executes /agents command", async () => {
        const result = await (tool as any).execute({ command: "/agents" });
        expect(result).toContain("OpenCode Orchestrator - 4-Agent Architecture");
        expect(result).toContain("Commander");
        expect(result).toContain("Planner");
        expect(result).toContain("Worker");
        expect(result).toContain("Reviewer");
    });
});
