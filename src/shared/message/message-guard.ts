/**
 * Message size guard.
 *
 * A single tool result can be enormous. Reading a screenshot, for example,
 * stores the image as one inline data URI of nearly two megabytes. Replaying
 * that part pushes the next request past the model context window, and from
 * then on every turn fails with an upstream error or an invalid-request
 * rejection, even after switching models.
 *
 * This guard truncates oversized parts right before the request is sent and
 * tells the model the payload was omitted. It is shape-agnostic: it walks both
 * the legacy message form (`parts`) and the current one (`content`).
 */

import { isRecord } from "../core/guards.js";

/** Parts longer than this are truncated. */
export const MAX_MESSAGE_PART_CHARS = 200_000;

const TRUNCATION_NOTE = "\n...[truncated by message guard]";
const OMITTED_PAYLOAD_NOTE = "[message guard omitted an oversized inline image/file payload of {size} chars]";
const IMAGE_DATA_URI = /data:image\/[a-z0-9.+-]+;base64,/i;

/** Truncate a text value. Inline image payloads are dropped whole. */
function capText(value: string): string {
    if (value.length <= MAX_MESSAGE_PART_CHARS) return value;
    if (IMAGE_DATA_URI.test(value)) {
        return OMITTED_PAYLOAD_NOTE.replace("{size}", String(value.length));
    }
    return value.slice(0, MAX_MESSAGE_PART_CHARS) + TRUNCATION_NOTE;
}

/** Cap a string field in place. Returns true when it changed. */
function capField(target: Record<string, unknown>, key: string): boolean {
    const value = target[key];
    if (typeof value !== "string") return false;
    const capped = capText(value);
    if (capped === value) return false;
    target[key] = capped;
    return true;
}

/** Cap the text/uri fields of a tool-result content array. */
function capContentArray(value: unknown): boolean {
    if (!Array.isArray(value)) return false;
    let changed = false;
    for (const item of value) {
        if (!isRecord(item)) continue;
        if (capField(item, "text")) changed = true;
        if (capField(item, "uri")) changed = true;
    }
    return changed;
}

/** Cap a tool-result `result` union (`json`/`text`/`error`/`content`). */
function capToolResult(result: unknown): boolean {
    if (!isRecord(result)) return false;
    if (result.type === "content") return capContentArray(result.value);
    return capField(result, "value");
}

/** Cap a legacy tool part's `state.output` and `state.content`. */
function capToolState(state: unknown): boolean {
    if (!isRecord(state)) return false;
    let changed = capField(state, "output");
    if (capContentArray(state.content)) changed = true;
    return changed;
}

/** Cap every oversized field of a single message part. */
function capPart(part: unknown): boolean {
    if (!isRecord(part)) return false;
    switch (part.type) {
        case "text":
        case "reasoning":
            return capField(part, "text");
        case "tool-result":
            return capToolResult(part.result);
        case "tool":
            return capToolState(part.state);
        default:
            return false;
    }
}

/**
 * Truncate oversized parts across a message list, in place. Returns the number
 * of parts that changed. Never throws on unexpected input.
 */
export function truncateOversizedMessageParts(messages: unknown): number {
    if (!Array.isArray(messages)) return 0;
    let truncated = 0;
    for (const message of messages) {
        if (!isRecord(message)) continue;
        const parts = Array.isArray(message.parts) ? message.parts : message.content;
        if (!Array.isArray(parts)) continue;
        for (const part of parts) {
            if (capPart(part)) truncated++;
        }
    }
    return truncated;
}
