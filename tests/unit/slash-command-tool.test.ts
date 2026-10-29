import { describe, it, expect } from "vitest";
import { COMMANDS } from "../../src/tools/slashCommand.js";

describe("slash COMMANDS", () => {
    it("keeps mission execution proportional and uses the retained completion schema", () => {
        const template = COMMANDS.task.template;
        expect(template).toContain("Handle small work directly");
        expect(template).toContain("status: completed");
        expect(template).toContain("pause");
        expect(template).toContain("$ARGUMENTS");
    });

    it("describes optional roles and a planning-only response", () => {
        expect(COMMANDS.plan.template).toContain("proportional");
        expect(COMMANDS.plan.template).toContain("Do not implement");
        expect(COMMANDS.plan.template).toContain("$ARGUMENTS");
        expect(COMMANDS.agents.template).toContain("optional");
    });

    it("describes the 4-agent architecture in /agents", () => {
        const template = COMMANDS.agents.template;
        expect(template).toContain("OpenCode Orchestrator - 4-Agent Architecture");
        for (const agent of ["Commander", "Planner", "Worker", "Reviewer"]) {
            expect(template).toContain(agent);
        }
    });

    it("registers exactly the task, plan, agents, stop and cancel commands", () => {
        expect(Object.keys(COMMANDS).sort()).toEqual(["agents", "cancel", "plan", "stop", "task"]);
        for (const command of Object.values(COMMANDS)) {
            expect(command.description.length).toBeGreaterThan(0);
        }
    });

    it.each(["stop", "cancel"])("exposes /%s as an argument-free mission loop command", (command) => {
        expect(COMMANDS[command].template).toContain("mission loop");
        expect(COMMANDS[command].template).not.toContain("$ARGUMENTS");
    });
});
