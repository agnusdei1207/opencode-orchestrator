export interface PruneTimer {
    start: () => void;
    shutdown: () => void;
}

export interface PruneTimerOptions {
    intervalMs: number;
    prune: () => void;
}

export function createPruneTimer(options: PruneTimerOptions): PruneTimer {
    let interval: ReturnType<typeof setInterval> | undefined;

    function start(): void {
        if (interval) return;

        interval = setInterval(options.prune, options.intervalMs);

        if (typeof interval === "object" && typeof interval.unref === "function") {
            interval.unref();
        }
    }

    function shutdown(): void {
        if (interval === undefined) return;

        clearInterval(interval);
        interval = undefined;
    }

    return {
        start,
        shutdown,
    };
}
