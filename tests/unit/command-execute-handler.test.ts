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
    });

    it.each(["task", "plan"])("does not activate missions for a user-owned /%s command", async (command) => {
        const output = { parts: [{ type: "text", text: "User-owned command: <mission>custom action</mission>" }] };
        await createCommandExecuteBeforeHandler(ctx)({ command, arguments: "custom action", sessionID: "native-root" }, output as never);
        expect(readLoopState(ctx.directory)).toBeNull();
        expect(ctx.sessions.size).toBe(0);
    });
});
