import type { Hooks } from "@opencode-ai/plugin";
import type { PluginHandlerContext } from "./context.js";
import { createMissionContextBuilder } from "./mission-context.js";

type MessagesTransformHook = NonNullable<Hooks["experimental.chat.messages.transform"]>;
type Message = Parameters<MessagesTransformHook>[1]["messages"][number];

export function createMissionMessagesHandler(ctx: PluginHandlerContext): MessagesTransformHook {
    const buildContext = createMissionContextBuilder(ctx);
    const injected = new WeakSet<Message>();
    return async (_input, { messages }) => {
        const previous = messages.at(-1);
        if (previous && injected.has(previous)) messages.pop();
        const tail = messages.at(-1);
        if (!tail) return;
        const user = [...messages].reverse().find(message => message.info.role === "user");
        if (user?.info.role !== "user" || user.info.sessionID !== tail.info.sessionID) return;
        const text = buildContext(tail.info.sessionID);
        if (!text) return;
        const id = `${tail.info.id}_orchestrator_context`;
        const message: Message = {
            info: { ...user.info, id },
            parts: [{
                id: `${id}_part`, messageID: id, sessionID: tail.info.sessionID,
                type: "text", text, synthetic: true,
            }],
        };
        // This hook edits only the outgoing copy; no session prompt or history write.
        injected.add(message);
        messages.push(message);
    };
}
