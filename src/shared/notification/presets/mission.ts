/**
 * Mission & Progress Presets
 */

import { show } from "../../../core/notification/toast-core.js";

export const missionComplete = (summary: string) => show({
    title: "Mission Complete",
    message: summary,
    variant: "success",
    duration: 0,
});

export const missionStarted = (description: string) => show({
    title: "Mission Started",
    message: description.slice(0, 100),
    variant: "info",
    duration: 4000,
});
