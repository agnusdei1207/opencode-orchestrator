import type { PluginInput } from "@opencode-ai/plugin";
import { MESSAGE_ROLES, PART_TYPES } from "../../../shared/index.js";

type OpencodeClient = PluginInput["client"];
type ResultPart = { type?: string; text?: string };
type ResultMessage = { info?: { role?: string }; parts?: ResultPart[] };

export async function fetchTaskResultText(
    client: OpencodeClient,
    sessionID: string
): Promise<string> {
    try {
        const result = await client.session.messages({ path: { id: sessionID } });
        if (result.error) return `Error: ${formatError(result.error)}`;

        return extractTaskResultText((result.data ?? []) as ResultMessage[]);
    } catch (error) {
        return `Error: ${formatError(error)}`;
    }
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
