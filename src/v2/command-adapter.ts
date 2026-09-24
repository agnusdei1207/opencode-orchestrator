import type { Plugin } from "@opencode/plugin";
import { MissionControlHook } from "../hooks/features/mission-loop.js";
import { COMMANDS } from "../tools/slashCommand.js";
import { PROMPTS } from "../shared/index.js";
import type { PluginHandlerContext } from "../plugin-handlers/context.js";

type Context = Plugin.Context;
type Registration = Awaited<ReturnType<Context["command"]["transform"]>>;
type CommandEditor = Parameters<Parameters<Context["command"]["transform"]>[0]>[0];
type CommandDefinition = Parameters<CommandEditor["add"]>[0];
type CommandInvocation = Parameters<CommandDefinition["execute"]>[0];

export async function registerV2Commands(
    context: Context,
    handlerContext: PluginHandlerContext,
): Promise<Registration> {
    return context.command.transform(editor => {
        for (const [name, command] of Object.entries(COMMANDS)) {
            editor.add({
                name,
                description: command.description,
                execute: input => executeCommand(context, handlerContext, name, input),
            });
        }
    });
}

async function executeCommand(
    context: Context,
    handlerContext: PluginHandlerContext,
    name: string,
    input: CommandInvocation,
): Promise<void> {
    const argument = input.prompt.text || PROMPTS.CONTINUE_DEFAULT;
    const mission = new MissionControlHook();
    const result = await mission.execute(
        { ...handlerContext, sessionID: input.sessionID },
        `/${name} ${argument}`,
    );
    if (name === "stop" || name === "cancel") return;
    const template = COMMANDS[name]?.template;
    const text = result.modifiedMessage ?? template?.replace(/\$ARGUMENTS/g, argument);
    if (text) await context.session.synthetic({ sessionID: input.sessionID, text, resume: true });
}
