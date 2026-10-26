/**
 * Diagnostic logging seam.
 *
 * Intentionally a no-op: writing to stdout/stderr corrupts the OpenCode TUI and
 * file logging added I/O on every hook, so both were removed. Call sites are
 * kept so instrumentation can be re-enabled in one place while debugging.
 */
export function log(..._args: unknown[]): void {
    // No-op by design; see the module comment.
}
