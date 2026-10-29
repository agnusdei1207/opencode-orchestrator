import type { HostClient, HostMessage } from "../../../host/client.js";

/** Text of the task's latest assistant reply, from messages created since `startedAt`. */
export async function fetchTaskResultText(
    client: HostClient,
    sessionID: string,
    startedAt?: Date,
): Promise<string> {
    const messages = await client.messages(sessionID);
    const current = startedAt
        ? messages.filter(message => message.created !== undefined && message.created >= startedAt.getTime())
        : messages;
    const latest = current.filter(message => message.role === "assistant").at(-1);
    assertLatestResultAvailable(latest, startedAt);
    return latest ? latest.text : "(No response)";
}

function assertLatestResultAvailable(latest: HostMessage | undefined, startedAt: Date | undefined): void {
    if (latest?.error) throw new Error(formatError(latest.error));
    if (startedAt && !latest?.completed) throw new Error("Current task result is not available");
}

function formatError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return typeof error === "string" ? error : JSON.stringify(error);
}
