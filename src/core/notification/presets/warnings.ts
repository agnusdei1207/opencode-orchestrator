/**
 * Warnings & Errors Presets
 */

import { show } from "../toast-core.js";

export const warningRateLimited = () => show({
    title: "Rate Limited",
    message: "Waiting before retry...",
    variant: "warning",
    duration: 5000,
});

export const errorRecovery = (action: string) => show({
    title: "Error Recovery",
    message: `Attempting: ${action}`,
    variant: "warning",
    duration: 3000,
});

export const warningMaxDepth = (depth: number) => show({
    title: "Max Depth Reached",
    message: `Recursion blocked at depth ${depth}`,
    variant: "warning",
    duration: 5000,
});

export const warningMaxRetries = () => show({
    title: "Max Retries Exceeded",
    message: "Automatic recovery has stopped. Manual intervention may be needed.",
    variant: "error",
    duration: 0,
});
