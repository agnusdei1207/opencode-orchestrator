/**
 * Session Management Presets
 */

import { show } from "../../../core/notification/toast-core.js";
import { TOAST_DURATION, STATUS_LABEL } from "../../index.js";

export const sessionCreated = (sessionId: string, agent: string) => show({
    title: "Session Created",
    message: `${agent} - ${sessionId.slice(0, 12)}...`,
    variant: STATUS_LABEL.INFO,
    duration: TOAST_DURATION.SHORT,
});

export const sessionResumed = (sessionId: string, agent: string) => show({
    title: "Session Resumed",
    message: `${agent} - ${sessionId.slice(0, 12)}...`,
    variant: STATUS_LABEL.INFO,
    duration: TOAST_DURATION.SHORT,
});

export const sessionCompleted = (sessionId: string, duration: string) => show({
    title: "Session Completed",
    message: `${sessionId.slice(0, 12)}... (${duration})`,
    variant: STATUS_LABEL.SUCCESS,
    duration: TOAST_DURATION.MEDIUM,
});

