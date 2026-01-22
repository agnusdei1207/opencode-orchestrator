/**
 * Tools & Research Presets
 */

import { show } from "../../../core/notification/toast-core.js";
import { PATHS, TOAST_DURATION } from "../../index.js";

export const toolExecuted = (toolName: string, target: string) => show({
    title: toolName,
    message: target.slice(0, 80),
    variant: "info",
    duration: TOAST_DURATION.SHORT,
});

export const documentCached = (filename: string) => show({
    title: "Document Cached",
    message: `${PATHS.DOCS}/${filename}`,
    variant: "info",
    duration: TOAST_DURATION.SHORT,
});

export const researchStarted = (topic: string) => show({
    title: "Research Started",
    message: topic,
    variant: "info",
    duration: TOAST_DURATION.MEDIUM,
});

