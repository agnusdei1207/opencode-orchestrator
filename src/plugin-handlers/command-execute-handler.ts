import type { Hooks } from "@opencode-ai/plugin";
import { MissionControlHook } from "../hooks/features/mission-loop.js";
import { COMMANDS } from "../tools/slashCommand.js";
import type { ToolExecuteHandlerContext } from "./context.js";

type CommandExecuteBeforeHook = NonNullable<Hooks["command.execute.before"]>;

// Native commands arrive after template expansion, so chat.message cannot see /task.
export function createCommandExecuteBeforeHandler(ctx: ToolExecuteHandlerContext): CommandExecuteBeforeHook {
    const missionCommand = new MissionControlHook();
    return async (input, output) => {
        if (input.command !== "task") return;
        const expected = COMMANDS.task.template.replace(/\$ARGUMENTS/g, input.arguments);
        // A user-owned command with the same name must retain its own behavior.
        if (!output.parts.some(part => part.type === "text" && part.text === expected)) return;
        await missionCommand.execute({ ...ctx, sessionID: input.sessionID }, `/task ${input.arguments}`);
    };
}
