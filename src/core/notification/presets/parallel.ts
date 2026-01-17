/**
 * Parallel Processing Presets
 */

import { show } from "../toast-core.js";
import { TOAST_DURATION } from "../../../shared/index.js";

export const parallelTasksLaunched = (count: number, agents: string[]) => show({
    title: "Parallel Tasks Launched",
    message: `${count} tasks: ${agents.join(", ")}`,
    variant: "info",
    duration: TOAST_DURATION.DEFAULT,
});

export const concurrencyAcquired = (agent: string, slot: string) => show({
    title: "Concurrency Slot",
    message: `${agent} acquired ${slot}`,
    variant: "info",
    duration: TOAST_DURATION.SHORT,
});

export const concurrencyReleased = (agent: string) => show({
    title: "Slot Released",
    message: agent,
    variant: "info",
    duration: TOAST_DURATION.EXTRA_SHORT,
});

