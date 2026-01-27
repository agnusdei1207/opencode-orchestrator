import { log } from '../agents/logger';

export enum ResourceType {
    SESSION = 'session',
    TIMER = 'timer',
    INTERVAL = 'interval',
    FILE_HANDLE = 'file_handle',
    MEMORY = 'memory',
}

interface TrackedResource {
    id: string;
    type: ResourceType;
    sessionID?: string;
    createdAt: number;
    metadata?: Record<string, unknown>;
    cleanup: () => Promise<void> | void;
}

/**
 * Centralized tracker for all resources that need explicit cleanup.
 * Ensures that resources tied to a specific session are cleaned up when the session ends.
 */
export class ResourceTracker {
    private static _instance: ResourceTracker;
    private resources: Map<string, TrackedResource> = new Map();
    private sessionResources: Map<string, Set<string>> = new Map();

    private constructor() { }

    static getInstance(): ResourceTracker {
        if (!ResourceTracker._instance) {
            ResourceTracker._instance = new ResourceTracker();
        }
        return ResourceTracker._instance;
    }

    /**
     * Start tracking a resource.
     */
    track(resource: TrackedResource): void {
        this.resources.set(resource.id, resource);

        if (resource.sessionID) {
            let set = this.sessionResources.get(resource.sessionID);
            if (!set) {
                set = new Set();
                this.sessionResources.set(resource.sessionID, set);
            }
            set.add(resource.id);
        }

        log(`[ResourceTracker] Tracked: ${resource.type}:${resource.id}` +
            (resource.sessionID ? ` (session: ${resource.sessionID.slice(0, 8)})` : ''));
    }

    /**
     * Release a specific resource by ID.
     */
    async release(id: string): Promise<boolean> {
        const resource = this.resources.get(id);
        if (!resource) return false;

        try {
            await resource.cleanup();
        } catch (err) {
            log(`[ResourceTracker] Cleanup error for ${id}: ${err}`);
        }

        this.resources.delete(id);

        if (resource.sessionID) {
            const set = this.sessionResources.get(resource.sessionID);
            set?.delete(id);
            if (set?.size === 0) {
                this.sessionResources.delete(resource.sessionID);
            }
        }

        log(`[ResourceTracker] Released: ${resource.type}:${id}`);
        return true;
    }

    /**
     * Release all resources associated with a specific sessionID.
     */
    async releaseAllForSession(sessionID: string): Promise<number> {
        const resourceIds = this.sessionResources.get(sessionID);
        if (!resourceIds || resourceIds.size === 0) return 0;

        let released = 0;
        const ids = Array.from(resourceIds); // Copy to avoid concurrent modification issues

        for (const id of ids) {
            if (await this.release(id)) {
                released++;
            }
        }

        log(`[ResourceTracker] Released ${released} resources for session ${sessionID.slice(0, 8)}`);
        return released;
    }

    /**
     * Release all resources of a specific type.
     */
    async releaseByType(type: ResourceType): Promise<number> {
        let released = 0;
        for (const [id, resource] of this.resources) {
            if (resource.type === type) {
                if (await this.release(id)) {
                    released++;
                }
            }
        }
        return released;
    }

    /**
     * Periodic GC for stale resources (e.g. leaked timers).
     */
    async cleanupStale(maxAgeMs: number): Promise<number> {
        const now = Date.now();
        let cleaned = 0;

        for (const [id, resource] of this.resources) {
            if (now - resource.createdAt > maxAgeMs) {
                if (await this.release(id)) {
                    cleaned++;
                }
            }
        }

        return cleaned;
    }

    /**
     * Shutdown the tracker and release all managed resources.
     */
    async shutdown(): Promise<void> {
        log(`[ResourceTracker] Shutting down, releasing ${this.resources.size} resources...`);

        const allIds = Array.from(this.resources.keys());
        // Use parallel settled to ensure all cleanups are attempted
        await Promise.allSettled(allIds.map(id => this.release(id)));

        this.resources.clear();
        this.sessionResources.clear();

        log('[ResourceTracker] Shutdown complete');
    }

    /**
     * Get current resource statistics.
     */
    getStats(): { total: number; byType: Record<string, number>; bySessions: number } {
        const byType: Record<string, number> = {};
        for (const type of Object.values(ResourceType)) {
            byType[type] = 0;
        }
        for (const resource of this.resources.values()) {
            byType[resource.type]++;
        }
        return {
            total: this.resources.size,
            byType,
            bySessions: this.sessionResources.size,
        };
    }
}

// Convenience helpers
export function trackTimer(timer: NodeJS.Timeout, sessionID?: string): string {
    const id = `timer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    ResourceTracker.getInstance().track({
        id,
        type: ResourceType.TIMER,
        sessionID,
        createdAt: Date.now(),
        cleanup: () => clearTimeout(timer),
    });
    return id;
}

export function trackInterval(interval: NodeJS.Timeout, sessionID?: string): string {
    const id = `interval_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    ResourceTracker.getInstance().track({
        id,
        type: ResourceType.INTERVAL,
        sessionID,
        createdAt: Date.now(),
        cleanup: () => clearInterval(interval),
    });
    return id;
}
