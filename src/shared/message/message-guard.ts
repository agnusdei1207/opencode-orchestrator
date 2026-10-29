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
 * tells the model the payload was omitted. It walks each message's `content`.
 */

import { isRecord } from "../core/guards.js";

/** Parts longer than this are truncated. */
export const MAX_MESSAGE_PART_CHARS = 200_000;

const TRUNCATION_NOTE = "\n...[truncated by message guard]";
const OMITTED_PAYLOAD_NOTE = "[message guard omitted an oversized inline image/file payload of {size} chars]";
const IMAGE_DATA_URI = /data:image\/[a-z0-9.+-]+;base64,/i;

function omittedPayload(size: number): string {
    return OMITTED_PAYLOAD_NOTE.replace("{size}", String(size));
}

/** Truncate a text value. Inline image payloads are dropped whole. */
function capText(value: string): string {
    if (value.length <= MAX_MESSAGE_PART_CHARS) return value;
    if (IMAGE_DATA_URI.test(value)) {
        return omittedPayload(value.length);
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

/** File omissions use text parts because providers decode file URIs as media. */
function capContentArray(value: unknown): boolean {
    if (!Array.isArray(value)) return false;
    let changed = false;
    for (const [index, item] of value.entries()) {
        if (!isRecord(item)) continue;
        if (item.type === "file" && typeof item.uri === "string" && item.uri.length > MAX_MESSAGE_PART_CHARS) {
            // Providers decode file URIs as media; an omission notice must be text.
            value[index] = { type: "text", text: omittedPayload(item.uri.length) };
            changed = true;
            continue;
        }
        if (capField(item, "text")) changed = true;
    }
    return changed;
}

/** Cap a tool-result `result` union (`json`/`text`/`error`/`content`). */
function capToolResult(result: unknown): boolean {
    if (!isRecord(result)) return false;
    if (result.type === "content") return capContentArray(result.value);
    if (typeof result.value === "string") return capField(result, "value");
    if (result.type !== "json" && result.type !== "text" && result.type !== "error") return false;
    const serialized = serializeResult(result.value);
    if (serialized === undefined || serialized.length <= MAX_MESSAGE_PART_CHARS) return false;
    // A truncated JSON fragment must not be presented as a structured result.
    if (result.type !== "error") result.type = "text";
    result.value = capText(serialized);
    return true;
}

function serializeResult(value: unknown): string | undefined {
    try {
        return JSON.stringify(value);
    } catch {
        return undefined;
    }
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
        if (!Array.isArray(message.content)) continue;
        for (const part of message.content) {
            if (capPart(part)) truncated++;
        }
    }
    return truncated;
}
