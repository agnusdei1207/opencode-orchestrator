import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCommandExecuteBeforeHandler } from "../../src/plugin-handlers/command-execute-handler";
import { readLoopState } from "../../src/core/loop/mission-loop";
import { COMMANDS } from "../../src/tools/slashCommand";
import type { ToolExecuteHandlerContext } from "../../src/plugin-handlers/context";
import { configureMissionRuntimeOptions } from "../../src/core/loop/mission-runtime-options";
import { cleanupSession } from "../../src/core/loop/mission-loop-handler";

describe("native mission command", () => {
    let ctx: ToolExecuteHandlerContext;
    beforeEach(() => {
        ctx = { directory: mkdtempSync(join(tmpdir(), "native-mission-command-")), sessions: new Map() };
        configureMissionRuntimeOptions({ ledger: false, markdownMemory: false });
    });
    afterEach(() => {
        cleanupSession("native-root");
        configureMissionRuntimeOptions({});
        rmSync(ctx.directory, { recursive: true, force: true });
    });

    it("persists a native /task goal after the host expands the owned template", async () => {
        const goal = "Verify the actual command boundary";
        const output = { parts: [{ type: "text", text: COMMANDS.task.template.replace(/\$ARGUMENTS/g, goal) }] };
        await createCommandExecuteBeforeHandler(ctx)({ command: "task", arguments: goal, sessionID: "native-root" }, output as never);
        expect(readLoopState(ctx.directory)).toMatchObject({ active: true, sessionID: "native-root", objective: goal });
        expect(ctx.sessions.get("native-root")?.active).toBe(true);
        expect(output.parts[0]).toMatchObject({ synthetic: true });
    });

    it.each(["plan", "agents", "stop", "cancel"])("hides the owned /%s instruction from user output", async (command) => {
        const output = { parts: [{ type: "text", text: COMMANDS[command].template.replace(/\$ARGUMENTS/g, "goal") }] };
        await createCommandExecuteBeforeHandler(ctx)({ command, arguments: "goal", sessionID: "native-root" }, output as never);
        expect(output.parts[0]).toMatchObject({ synthetic: true });
    });

    it.each(["task", "plan"])("does not activate missions for a user-owned /%s command", async (command) => {
        const output = { parts: [{ type: "text", text: "User-owned command: <mission>custom action</mission>" }] };
        await createCommandExecuteBeforeHandler(ctx)({ command, arguments: "custom action", sessionID: "native-root" }, output as never);
        expect(readLoopState(ctx.directory)).toBeNull();
        expect(ctx.sessions.size).toBe(0);
        expect(output.parts[0]).not.toHaveProperty("synthetic");
    });

    it.each(["constructor", "toString"])("ignores unrelated /%s commands", async (command) => {
        const output = { parts: [{ type: "text", text: "User-owned command" }] };
        await expect(createCommandExecuteBeforeHandler(ctx)(
            { command, arguments: "", sessionID: "native-root" }, output as never,
        )).resolves.toBeUndefined();
        expect(output.parts[0]).not.toHaveProperty("synthetic");
    });

    it.each(["stop", "cancel"])("cancels an active loop for an owned /%s command after host expansion", async (command) => {
        const goal = "Stop the loop";
        const taskOutput = { parts: [{ type: "text", text: COMMANDS.task.template.replace(/\$ARGUMENTS/g, goal) }] };
        await createCommandExecuteBeforeHandler(ctx)({ command: "task", arguments: goal, sessionID: "native-root" }, taskOutput as never);
        expect(readLoopState(ctx.directory)).toMatchObject({ active: true });

        const stopOutput = { parts: [{ type: "text", text: COMMANDS[command].template }] };
        await createCommandExecuteBeforeHandler(ctx)({ command, arguments: "", sessionID: "native-root" }, stopOutput as never);
        expect(readLoopState(ctx.directory)).toBeNull();
    });

    it.each(["stop", "cancel"])("does not cancel missions for a user-owned /%s command", async (command) => {
        const goal = "Keep running";
        const taskOutput = { parts: [{ type: "text", text: COMMANDS.task.template.replace(/\$ARGUMENTS/g, goal) }] };
        await createCommandExecuteBeforeHandler(ctx)({ command: "task", arguments: goal, sessionID: "native-root" }, taskOutput as never);
        expect(readLoopState(ctx.directory)).toMatchObject({ active: true });

        const output = { parts: [{ type: "text", text: "User-owned command: stop everything" }] };
        await createCommandExecuteBeforeHandler(ctx)({ command, arguments: "", sessionID: "native-root" }, output as never);
        expect(readLoopState(ctx.directory)).toMatchObject({ active: true });
    });
});
