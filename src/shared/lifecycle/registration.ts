/**
 * Registration Interface
 *
 * Common interface for registering handlers, hooks, callbacks, and listeners
 * with priority-based execution order and metadata.
 */

/**
 * Basic registration with name and priority
 */
export interface Registration<T> {
    /** The handler/hook/callback function */
    handler: T;
    /** Unique identifier for this registration */
    name: string;
    /** Priority (lower numbers execute first, 0-100) */
    priority: number;
}

/**
 * Extended registration with optional metadata
 */
export interface RegistrationWithMetadata<T> extends Registration<T> {
    /** Additional metadata for registration */
    metadata?: Record<string, unknown>;
}

/**
 * Cleanup handler registration
 */
export interface CleanupRegistration {
    name: string;
    fn: () => void | Promise<void>;
    priority: number;
}


/**
 * Extended registration with optional metadata
 */
export interface RegistrationWithMetadata<T> extends Registration<T> {
    /** Additional metadata for the registration */
    metadata?: Record<string, unknown>;
}

/**
 * Cleanup handler registration
 */
export interface CleanupRegistration {
    name: string;
    fn: () => void | Promise<void>;
    priority: number;
}

/**
 * Hook registration with phase support
 */
export interface HookRegistration<T> {
    hook: T;
    metadata: {
        name: string;
        priority: number;
        phase?: "early" | "normal" | "late";
        dependencies?: string[];
        errorHandling?: "continue" | "stop" | "retry";
    };
}
