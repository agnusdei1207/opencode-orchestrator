import type { Hooks } from "@opencode-ai/plugin";
import { MissionControlHook } from "../hooks/features/mission-loop.js";
import { COMMANDS } from "../tools/slashCommand.js";
import { COMMAND_NAMES } from "../shared/index.js";
import type { ToolExecuteHandlerContext } from "./context.js";

type CommandExecuteBeforeHook = NonNullable<Hooks["command.execute.before"]>;

// Native commands arrive after template expansion, so chat.message cannot see /task.
export function createCommandExecuteBeforeHandler(ctx: ToolExecuteHandlerContext): CommandExecuteBeforeHook {
    const missionCommand = new MissionControlHook();
    return async (input, output) => {
        if (!Object.hasOwn(COMMANDS, input.command)) return;
        const command = COMMANDS[input.command];
        if (!command) return;
        const expected = command.template.replace(/\$ARGUMENTS/g, input.arguments);
        const part = output.parts.find(part => part.type === "text" && part.text === expected);
        // A user-owned command with the same name must retain its own behavior.
        if (!part || part.type !== "text") return;

        if (input.command === COMMAND_NAMES.STOP || input.command === COMMAND_NAMES.CANCEL) {
            await missionCommand.execute({ ...ctx, sessionID: input.sessionID }, `/${input.command}`);
        } else if (input.command === COMMAND_NAMES.TASK) {
            await missionCommand.execute({ ...ctx, sessionID: input.sessionID }, `/task ${input.arguments}`);
        }
        part.synthetic = true;
    };
}
