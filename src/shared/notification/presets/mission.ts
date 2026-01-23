/**
 * Mission & Progress Presets
 */

import { show } from "../../../core/notification/toast-core.js";
import { TOAST_VARIANTS } from "../constants/index.js";

export const missionComplete = (summary: string) => show({
    title: "Mission Complete",
    message: summary,
    variant: TOAST_VARIANTS.SUCCESS,
    duration: 0,
});

export const missionStarted = (description: string) => show({
    title: "Mission Started",
    message: description.slice(0, 100),
    variant: TOAST_VARIANTS.INFO,
    duration: 4000,
});

