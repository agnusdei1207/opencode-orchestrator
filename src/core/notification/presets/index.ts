/**
 * Notification Presets - Index
 */

export {
    taskStarted,
    taskCompleted,
    taskFailed,
    allTasksComplete,
} from "./task-lifecycle.js";

export {
    sessionCreated,
    sessionResumed,
    sessionCompleted,
} from "./session.js";

export {
    parallelTasksLaunched,
    concurrencyAcquired,
    concurrencyReleased,
} from "./parallel.js";

export {
    missionComplete,
    missionStarted,
} from "./mission.js";

export {
    toolExecuted,
    documentCached,
    researchStarted,
} from "./tools.js";

export {
    warningRateLimited,
    errorRecovery,
    warningMaxDepth,
    warningMaxRetries,
} from "./warnings.js";
