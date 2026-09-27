import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCommandExecuteBeforeHandler } from "../../src/plugin-handlers/command-execute-handler";
import { readLoopState } from "../../src/core/loop/mission-loop";
import { COMMANDS } from "../../src/tools/slashCommand";
import type { ToolExecuteHandlerContext } from "../../src/plugin-handlers/context";
import { configureMissionRuntimeOptions } from "../../src/core/loop/mission-runtime-options";
import { cleanupSession } from "../../src/core/loop/mission-loop-handler";
import { ParallelAgentManager } from "../../src/core/agents/manager";

vi.mock("../../src/core/agents/manager", () => ({
    ParallelAgentManager: { getInstance: vi.fn() },
}));

describe("native mission command", () => {
    let ctx: ToolExecuteHandlerContext;
    const status = vi.fn();
    const abort = vi.fn();
    const cancelTasksForParent = vi.fn();
    beforeEach(() => {
        vi.clearAllMocks();
        status.mockResolvedValue({ data: {} });
        abort.mockResolvedValue({ data: true });
        cancelTasksForParent.mockResolvedValue(true);
        vi.mocked(ParallelAgentManager.getInstance).mockReturnValue({ cancelTasksForParent } as never);
        ctx = {
            client: { session: { status, abort } } as never,
            directory: mkdtempSync(join(tmpdir(), "native-mission-command-")),
            sessions: new Map(),
        };
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

    it("replaces a project mission when /task is submitted from a new session", async () => {
        const oldOutput = { parts: [{ type: "text", text: COMMANDS.task.template.replace(/\$ARGUMENTS/g, "Old goal") }] };
        await createCommandExecuteBeforeHandler(ctx)({ command: "task", arguments: "Old goal", sessionID: "native-root" }, oldOutput as never);

        const newOutput = { parts: [{ type: "text", text: COMMANDS.task.template.replace(/\$ARGUMENTS/g, "New goal") }] };
        await createCommandExecuteBeforeHandler(ctx)({ command: "task", arguments: "New goal", sessionID: "new-root" }, newOutput as never);

        expect(readLoopState(ctx.directory)).toMatchObject({ sessionID: "new-root", objective: "New goal" });
        expect(ctx.sessions.get("native-root")?.active).toBe(false);
        expect(ctx.sessions.get("new-root")?.active).toBe(true);
        expect(newOutput.parts[0]).toMatchObject({ synthetic: true });
        expect(abort).not.toHaveBeenCalled();
    });

    it("aborts a busy owner and cancels child tasks before replacing its mission", async () => {
        const run = createCommandExecuteBeforeHandler(ctx);
        await run({ command: "task", arguments: "Old goal", sessionID: "native-root" }, {
            parts: [{ type: "text", text: COMMANDS.task.template.replace(/\$ARGUMENTS/g, "Old goal") }],
        } as never);
        status.mockResolvedValue({ data: { "native-root": { type: "busy" } } });
        await run({ command: "task", arguments: "New goal", sessionID: "new-root" }, {
            parts: [{ type: "text", text: COMMANDS.task.template.replace(/\$ARGUMENTS/g, "New goal") }],
        } as never);
        expect(abort).toHaveBeenCalledWith({ path: { id: "native-root" } });
        expect(cancelTasksForParent).toHaveBeenCalledWith("native-root");
        expect(readLoopState(ctx.directory)).toMatchObject({ sessionID: "new-root" });
    });

    it.each(["false", "error", "rejected"])("keeps the old mission when abort is %s", async (failure) => {
        const run = createCommandExecuteBeforeHandler(ctx);
        await run({ command: "task", arguments: "Old goal", sessionID: "native-root" }, {
            parts: [{ type: "text", text: COMMANDS.task.template.replace(/\$ARGUMENTS/g, "Old goal") }],
        } as never);
        status.mockResolvedValue({ data: { "native-root": { type: "busy" } } });
        if (failure === "rejected") abort.mockRejectedValueOnce(new Error("abort unavailable"));
        else abort.mockResolvedValueOnce(failure === "error" ? { error: "offline" } : { data: false });
        await expect(run({ command: "task", arguments: "New goal", sessionID: "new-root" }, {
            parts: [{ type: "text", text: COMMANDS.task.template.replace(/\$ARGUMENTS/g, "New goal") }],
        } as never)).rejects.toThrow();
        expect(readLoopState(ctx.directory)).toMatchObject({ sessionID: "native-root" });
        expect(cancelTasksForParent).not.toHaveBeenCalled();
    });

    it("replaces a persisted mission after the owning session leaves memory", async () => {
        const run = createCommandExecuteBeforeHandler(ctx);
        await run({ command: "task", arguments: "Old goal", sessionID: "native-root" }, {
            parts: [{ type: "text", text: COMMANDS.task.template.replace(/\$ARGUMENTS/g, "Old goal") }],
        } as never);
        ctx.sessions.clear();
        await run({ command: "task", arguments: "New goal", sessionID: "new-root" }, {
            parts: [{ type: "text", text: COMMANDS.task.template.replace(/\$ARGUMENTS/g, "New goal") }],
        } as never);
        expect(readLoopState(ctx.directory)).toMatchObject({ sessionID: "new-root", objective: "New goal" });
    });

    it("keeps the old mission when delegated work cannot be cancelled", async () => {
        const run = createCommandExecuteBeforeHandler(ctx);
        await run({ command: "task", arguments: "Old goal", sessionID: "native-root" }, {
            parts: [{ type: "text", text: COMMANDS.task.template.replace(/\$ARGUMENTS/g, "Old goal") }],
        } as never);
        cancelTasksForParent.mockResolvedValueOnce(false);
        await expect(run({ command: "task", arguments: "New goal", sessionID: "new-root" }, {
            parts: [{ type: "text", text: COMMANDS.task.template.replace(/\$ARGUMENTS/g, "New goal") }],
        } as never)).rejects.toThrow("delegated tasks");
        expect(readLoopState(ctx.directory)).toMatchObject({ sessionID: "native-root" });
        expect(ctx.sessions.get("new-root")).toBeUndefined();
    });

    it("does not replace a mission when the host client is unavailable", async () => {
        const run = createCommandExecuteBeforeHandler(ctx);
        await run({ command: "task", arguments: "Old goal", sessionID: "native-root" }, {
            parts: [{ type: "text", text: COMMANDS.task.template.replace(/\$ARGUMENTS/g, "Old goal") }],
        } as never);
        const withoutClient = { ...ctx, client: undefined } as unknown as ToolExecuteHandlerContext;
        await expect(createCommandExecuteBeforeHandler(withoutClient)(
            { command: "task", arguments: "New goal", sessionID: "new-root" },
            { parts: [{ type: "text", text: COMMANDS.task.template.replace(/\$ARGUMENTS/g, "New goal") }] } as never,
        )).rejects.toThrow("session client");
        expect(readLoopState(ctx.directory)).toMatchObject({ sessionID: "native-root" });
    });

    it("restarts a mission in its owning session without aborting it", async () => {
        const run = createCommandExecuteBeforeHandler(ctx);
        await run({ command: "task", arguments: "Old goal", sessionID: "native-root" }, {
            parts: [{ type: "text", text: COMMANDS.task.template.replace(/\$ARGUMENTS/g, "Old goal") }],
        } as never);
        await run({ command: "task", arguments: "Updated goal", sessionID: "native-root" }, {
            parts: [{ type: "text", text: COMMANDS.task.template.replace(/\$ARGUMENTS/g, "Updated goal") }],
        } as never);
        expect(readLoopState(ctx.directory)).toMatchObject({ sessionID: "native-root", objective: "Updated goal" });
        expect(abort).not.toHaveBeenCalled();
        expect(cancelTasksForParent).not.toHaveBeenCalled();
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
