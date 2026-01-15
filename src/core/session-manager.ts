import type { PluginInput } from "@opencode-ai/plugin";
import { state } from "../core/state.js";
import {
  DEFAULT_MAX_STEPS,
  TASK_COMMAND_MAX_STEPS,
} from "../constants/time.js";

export interface SessionEvents {
  created: (sessionID: string) => void;
  activated: (sessionID: string) => void;
  deactivated: (sessionID: string, reason?: string) => void;
  step: (sessionID: string, step: number) => void;
  completed: (sessionID: string, result: any) => void;
  error: (sessionID: string, error: Error) => void;
  disposed: (sessionID: string) => void;
}

export interface SessionState {
  active: boolean;
  step: number;
  maxSteps: number;
  timestamp: number;
  startTime: number;
  lastStepTime: number;
  eventQueue: Map<string, any[]>;
}

export interface SessionOptions {
  maxSteps?: number;
}

export class SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  private events: SessionEvents = {
    created: () => { },
    activated: () => { },
    deactivated: () => { },
    step: () => { },
    completed: () => { },
    error: () => { },
    disposed: () => { },
  };

  on(event: keyof SessionEvents, handler: SessionEvents[keyof SessionEvents]): void {
    this.events[event] = handler as any;
  }

  emit(event: keyof SessionEvents, sessionID: string, data?: any): void {
    const handler = this.events[event] as any;
    if (handler) {
      handler(sessionID, data);
    }
  }

  create(sessionID: string, options?: SessionOptions): SessionState {
    const session: SessionState = {
      active: false,
      step: 0,
      maxSteps: options?.maxSteps ?? DEFAULT_MAX_STEPS,
      timestamp: Date.now(),
      startTime: Date.now(),
      lastStepTime: Date.now(),
      eventQueue: new Map(),
    };

    this.sessions.set(sessionID, session);
    this.emit("created", sessionID);
    return session;
  }

  activate(sessionID: string): void {
    const session = this.sessions.get(sessionID);
    if (!session) {
      throw new Error(`Session ${sessionID} not found`);
    }

    session.active = true;
    session.timestamp = Date.now();
    this.emit("activated", sessionID);
  }

  deactivate(sessionID: string, reason?: string): void {
    const session = this.sessions.get(sessionID);
    if (!session) return;

    session.active = false;
    session.timestamp = Date.now();
    this.emit("deactivated", sessionID, reason);
  }

  step(sessionID: string): void {
    const session = this.sessions.get(sessionID);
    if (!session) return;

    if (!session.active) {
      throw new Error(`Session ${sessionID} is not active`);
    }

    const now = Date.now();
    const stepDuration = now - session.lastStepTime;

    session.step++;
    session.timestamp = now;
    session.lastStepTime = now;

    this.emit("step", sessionID, session.step);

    const stateSession = state.sessions.get(sessionID);
    if (stateSession) {
      stateSession.iterations++;
    }
  }

  complete(sessionID: string, result: any): void {
    const session = this.sessions.get(sessionID);
    if (!session) return;

    const duration = Date.now() - session.startTime;

    this.deactivate(sessionID, "completed");

    const stateSession = state.sessions.get(sessionID);
    if (stateSession) {
      stateSession.currentTask = "";
    }

    this.emit("completed", sessionID, { result, duration });
    this.dispose(sessionID);
  }

  error(sessionID: string, error: Error): void {
    const session = this.sessions.get(sessionID);
    if (!session) return;

    this.deactivate(sessionID, "error");
    this.emit("error", sessionID, error);
    this.dispose(sessionID);
  }

  dispose(sessionID: string): void {
    const session = this.sessions.get(sessionID);
    if (!session) return;

    session.active = false;
    session.eventQueue.clear();
    this.sessions.delete(sessionID);
    this.emit("disposed", sessionID);
  }

  get(sessionID: string): SessionState | undefined {
    return this.sessions.get(sessionID);
  }

  isActive(sessionID: string): boolean {
    return this.sessions.get(sessionID)?.active ?? false;
  }

  getAll(): SessionState[] {
    return Array.from(this.sessions.values());
  }

  cleanupInactive(maxAgeMs: number): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [sessionID, session] of this.sessions.entries()) {
      if (!session.active && (now - session.timestamp) > maxAgeMs) {
        this.dispose(sessionID);
        cleaned++;
      }
    }

    return cleaned;
  }
}

export const sessionManager = new SessionManager();
