/**
 * Runtime type guards shared by every layer.
 */

/** A plain object usable as a string-keyed record; arrays and null are excluded. */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
