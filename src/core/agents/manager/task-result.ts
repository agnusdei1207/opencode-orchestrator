import type { PluginInput } from "@opencode-ai/plugin";
import { MESSAGE_ROLES, PART_TYPES } from "../../../shared/index.js";

type OpencodeClient = PluginInput["client"];
type ResultPart = { type?: string; text?: string };
type ResultMessage = { info?: { role?: string; error?: unknown; time?: { created?: number; completed?: number } }; parts?: ResultPart[] };

export async function fetchTaskResultText(
    client: OpencodeClient,
    sessionID: string,
    startedAt?: Date,
): Promise<string> {
    const result = await client.session.messages({ path: { id: sessionID } });
    if (result.error) throw new Error(formatError(result.error));
    const messages = (result.data ?? []) as ResultMessage[];
    const current = startedAt ? messages.filter(message =>
        message.info?.time?.created !== undefined && message.info.time.created >= startedAt.getTime()
    ) : messages;
    const latest = current.filter(message => message.info?.role === MESSAGE_ROLES.ASSISTANT).at(-1);
    if (latest?.info?.error) throw new Error(formatError(latest.info.error));
    if (startedAt && !latest?.info?.time?.completed) throw new Error("Current task result is not available");
    return extractTaskResultText(current);
}

export function extractTaskResultText(messages: ResultMessage[]): string {
    const lastMsg = messages.filter(m => m.info?.role === MESSAGE_ROLES.ASSISTANT).reverse()[0];
    if (!lastMsg) return "(No response)";

    return lastMsg.parts
        ?.filter(p => p.type === PART_TYPES.TEXT || p.type === PART_TYPES.REASONING)
        .map(p => p.text ?? "")
        .filter(Boolean)
        .join("\n") ?? "";
}

function formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
