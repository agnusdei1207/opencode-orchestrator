/**
 * Parallel Processing Presets
 */

import { show } from "../toast-core.js";

export const parallelTasksLaunched = (count: number, agents: string[]) => show({
    title: "Parallel Tasks Launched",
    message: `${count} tasks: ${agents.join(", ")}`,
    variant: "info",
    duration: 4000,
});

export const concurrencyAcquired = (agent: string, slot: string) => show({
    title: "Concurrency Slot",
    message: `${agent} acquired ${slot}`,
    variant: "info",
    duration: 2000,
});

export const concurrencyReleased = (agent: string) => show({
    title: "Slot Released",
    message: agent,
    variant: "info",
    duration: 1500,
});
