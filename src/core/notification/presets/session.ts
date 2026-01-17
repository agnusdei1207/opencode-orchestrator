/**
 * Session Management Presets
 */

import { show } from "../toast-core.js";

export const sessionCreated = (sessionId: string, agent: string) => show({
    title: "Session Created",
    message: `${agent} - ${sessionId.slice(0, 12)}...`,
    variant: "info",
    duration: 2000,
});

export const sessionResumed = (sessionId: string, agent: string) => show({
    title: "Session Resumed",
    message: `${agent} - ${sessionId.slice(0, 12)}...`,
    variant: "info",
    duration: 2000,
});

export const sessionCompleted = (sessionId: string, duration: string) => show({
    title: "Session Completed",
    message: `${sessionId.slice(0, 12)}... (${duration})`,
    variant: "success",
    duration: 3000,
});
