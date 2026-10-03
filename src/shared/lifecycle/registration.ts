/**
 * Registration Interface
 *
 * Cleanup handler contract used by the shutdown manager.
 */

/**
 * Cleanup handler registration
 */
export interface CleanupRegistration {
    name: string;
    fn: () => void | Promise<void>;
    priority: number;
    /** Per-handler budget; handlers that wait on external processes may need more than the default. */
    timeoutMs?: number;
}
