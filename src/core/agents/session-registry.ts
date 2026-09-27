/** Tracks child sessions until the host can safely delete them. */

import type { PluginInput } from "@opencode-ai/plugin";
import { PARALLEL_TASK } from "../../shared/index.js";
import { log } from "./logger.js";
import { withTimeout } from "../async/with-timeout.js";
import { getLastActivityAt, isSessionBusy } from "../session/activity.js";
import { SessionDeletionUnavailableError } from "../../shared/errors/session-deletion-unavailable.js";

interface TrackedSession {
    id: string;
    inUse: boolean;
    lastUsedAt: Date;
    releasedAt?: Date;
    deleteDeferredSince?: number;
}

interface SessionRegistryConfig {
    idleTimeoutMs: number;
    healthCheckIntervalMs: number;
}

type DeletionGate =
    | { kind: "ready" }
    | { kind: "busy" }
    | { kind: "settling"; delayMs: number };

const DEFAULT_CONFIG: SessionRegistryConfig = {
    idleTimeoutMs: 300_000,
    healthCheckIntervalMs: 60_000,
};

// OpenCode may still project message rows after a run reports idle (issue #41).
export const DELETE_SETTLE_MS = 10_000;
export const DELETE_RETRY_MS = 5_000;
export const DELETE_MAX_DEFER_MS = 10 * 60_000;

function normalizeConfig(config: Partial<SessionRegistryConfig>): SessionRegistryConfig {
    const normalized = { ...DEFAULT_CONFIG, ...config };
    for (const [name, value] of Object.entries(normalized)) {
        if (!Number.isInteger(value) || value < 1) {
            throw new Error(`SessionRegistry ${name} must be a positive integer, got ${value}`);
        }
    }
    return normalized;
}

function shortID(sessionID: string): string {
    return `${sessionID.slice(0, 8)}...`;
}

export class SessionRegistry {
    private static _instance: SessionRegistry | undefined;

    private sessionsById = new Map<string, TrackedSession>();
    private deleteTimers = new Map<string, NodeJS.Timeout>();
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private config: SessionRegistryConfig;

    private constructor(
        private client: PluginInput["client"],
        private directory: string,
        config: Partial<SessionRegistryConfig> = {},
    ) {
        this.config = normalizeConfig(config);
        this.startHealthCheck();
    }

    static getInstance(
        client?: PluginInput["client"],
        directory?: string,
        config?: Partial<SessionRegistryConfig>,
    ): SessionRegistry {
        if (!SessionRegistry._instance) {
            if (!client || !directory) {
                throw new Error("SessionRegistry requires client and directory on first call");
            }
            SessionRegistry._instance = new SessionRegistry(client, directory, config);
        }
        return SessionRegistry._instance;
    }

    async acquire(agentName: string, parentSessionID: string, description: string): Promise<TrackedSession> {
        log(`[SessionRegistry] Creating new session for ${agentName}`);
        const result = await withTimeout(
            this.client.session.create({
                body: {
                    parentID: parentSessionID,
                    title: `${PARALLEL_TASK.SESSION_TITLE_PREFIX}: ${description}`,
                },
                query: { directory: this.directory },
            }),
            60_000,
            "Session creation timed out after 60s",
        );
        if (result.error || !result.data?.id) {
            throw new Error(`Session creation failed: ${result.error || "No ID"}`);
        }
        const session: TrackedSession = { id: result.data.id, inUse: true, lastUsedAt: new Date() };
        this.sessionsById.set(session.id, session);
        return session;
    }

    async release(sessionID: string): Promise<void> {
        const session = this.sessionsById.get(sessionID);
        if (!session) return;
        // Neither supported plugin API can clear a child transcript for safe reuse.
        session.inUse = false;
        session.releasedAt = new Date();
        await this.invalidate(sessionID);
    }

    async invalidate(sessionID: string): Promise<void> {
        if (await this.deleteSession(sessionID)) {
            log(`[SessionRegistry] Invalidated session ${shortID(sessionID)}`);
        }
    }

    forget(sessionID: string): void {
        if (!this.sessionsById.has(sessionID)) return;
        this.cancelDeferredDelete(sessionID);
        this.sessionsById.delete(sessionID);
        log(`[SessionRegistry] Forgot session ${shortID(sessionID)} deleted outside the registry`);
    }

    async cleanup(): Promise<number> {
        const now = Date.now();
        let cleaned = 0;
        for (const [sessionID, session] of this.sessionsById) {
            if (session.inUse || now - session.lastUsedAt.getTime() <= this.config.idleTimeoutMs) continue;
            if (await this.deleteSession(sessionID)) cleaned++;
        }
        if (cleaned) log(`[SessionRegistry] Cleaned up ${cleaned} stale sessions`);
        return cleaned;
    }

    async shutdown(): Promise<void> {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        for (const sessionID of this.deleteTimers.keys()) this.cancelDeferredDelete(sessionID);

        try {
            const deletions: Promise<unknown>[] = [];
            for (const [sessionID, session] of this.sessionsById) {
                if (session.inUse || (await this.deletionGate(session)).kind !== "ready") continue;
                deletions.push(this.deleteSessionNow(sessionID).catch(error => {
                    log(`[SessionRegistry] Shutdown delete failed for ${shortID(sessionID)}`, error);
                }));
            }
            await Promise.all(deletions);
        } finally {
            this.sessionsById.clear();
            if (SessionRegistry._instance === this) SessionRegistry._instance = undefined;
        }
    }

    private async deleteSession(sessionID: string): Promise<boolean> {
        const session = this.sessionsById.get(sessionID);
        if (!session) return false;
        if (session.inUse) return false;

        const gate = await this.deletionGate(session);
        if (gate.kind === "ready") return this.deleteSessionNow(sessionID);

        session.deleteDeferredSince ??= Date.now();
        if (Date.now() - session.deleteDeferredSince > DELETE_MAX_DEFER_MS) {
            log(`[SessionRegistry] Session ${shortID(sessionID)} never settled; leaving it to the host`);
            this.cancelDeferredDelete(sessionID);
            this.sessionsById.delete(sessionID);
            return false;
        }
        const delayMs = gate.kind === "busy" ? DELETE_RETRY_MS : gate.delayMs;
        this.scheduleDeferredDelete(sessionID, delayMs);
        return false;
    }

    private async deletionGate(session: TrackedSession): Promise<DeletionGate> {
        if (await isSessionBusy(this.client, session.id)) return { kind: "busy" };
        const lastActivity = Math.max(
            session.lastUsedAt.getTime(),
            session.releasedAt?.getTime() ?? 0,
            getLastActivityAt(session.id) ?? 0,
        );
        const quietFor = Date.now() - lastActivity;
        if (quietFor < DELETE_SETTLE_MS) {
            return { kind: "settling", delayMs: DELETE_SETTLE_MS - quietFor };
        }
        return { kind: "ready" };
    }

    private scheduleDeferredDelete(sessionID: string, delayMs: number): void {
        if (this.deleteTimers.has(sessionID)) return;
        const timer = setTimeout(() => {
            this.deleteTimers.delete(sessionID);
            this.deleteSession(sessionID).catch(error => {
                log(`[SessionRegistry] Deferred delete failed for ${shortID(sessionID)}`, error);
            });
        }, Math.max(delayMs, 0));
        timer.unref?.();
        this.deleteTimers.set(sessionID, timer);
    }

    private cancelDeferredDelete(sessionID: string): void {
        const timer = this.deleteTimers.get(sessionID);
        if (!timer) return;
        clearTimeout(timer);
        this.deleteTimers.delete(sessionID);
    }

    private async deleteSessionNow(sessionID: string): Promise<boolean> {
        this.cancelDeferredDelete(sessionID);
        try {
            const response = await this.client.session.delete({ path: { id: sessionID } });
            if (response.error || response.data !== true) {
                log(`[SessionRegistry] Host did not confirm deletion ${shortID(sessionID)}`, response.error ?? response.data);
                return false;
            }
        } catch (error) {
            if (error instanceof SessionDeletionUnavailableError) {
                log(`[SessionRegistry] Host plugin cannot delete ${shortID(sessionID)}; leaving it to the host`);
                this.sessionsById.delete(sessionID);
                return false;
            }
            log(`[SessionRegistry] Host delete failed for ${shortID(sessionID)}`, error);
            return false;
        }
        this.sessionsById.delete(sessionID);
        return true;
    }

    private startHealthCheck(): void {
        this.healthCheckInterval = setInterval(() => {
            this.cleanup().catch(error => log("[SessionRegistry] Health check cleanup failed", error));
        }, this.config.healthCheckIntervalMs);
        this.healthCheckInterval.unref?.();
    }
}
