import type { PluginInput } from "@opencode-ai/plugin";
import { TOAST_DURATION } from "../../shared/index.js";
import { log } from "../agents/logger.js";

type OpencodeClient = PluginInput["client"];

const TOAST_DURATION_MS = TOAST_DURATION.EXTRA_SHORT;

export async function showContinuationCountdownToast(
    client: OpencodeClient,
    secondsRemaining: number,
    incompleteCount: number
): Promise<void> {
    try {
        if (client.tui?.showToast) {
            await client.tui.showToast({
                body: {
                    title: "📋 Todo Continuation",
                    message: `Resuming in ${secondsRemaining}s... (${incompleteCount} tasks remaining)`,
                    variant: "warning",
                    duration: TOAST_DURATION_MS,
                },
            });
        }
    } catch (error) {
        log("[todo-continuation] Toast failed:", error);
    }
}
