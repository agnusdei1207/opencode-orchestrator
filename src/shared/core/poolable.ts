/**
 * Poolable Interface
 *
 * Objects that can be pooled for performance optimization must implement this.
 * Reduces GC pressure by reusing objects instead of allocating new ones.
 */

export interface Poolable {
    /**
     * Reset object to initial state for reuse
     */
    reset(): void;
}
