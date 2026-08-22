/**
 * Plugin API conformance.
 *
 * The plugin talks to OpenCode across three surfaces, and a rename on any of
 * them fails silently rather than loudly: an unknown hook key is simply never
 * called, and an event type nobody publishes never fires. TypeScript does not
 * catch either, because both are plain strings.
 *
 * These tests pin every name we depend on to the authoritative declarations that
 * ship in `node_modules`, so a dependency bump that moves one is a test failure
 * instead of a feature that quietly stops working.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SRC_ROOT = join(ROOT, "src");

const PLUGIN_TYPES = readFileSync(
    join(ROOT, "node_modules/@opencode-ai/plugin/dist/index.d.ts"), "utf8");
const SDK_TYPES = readFileSync(
    join(ROOT, "node_modules/@opencode-ai/sdk/dist/gen/sdk.gen.d.ts"), "utf8");
const SDK_EVENT_TYPES = readFileSync(
    join(ROOT, "node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts"), "utf8");

function sourceFiles(dir = SRC_ROOT, prefix = ""): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) return sourceFiles(join(dir, entry.name), rel);
        return entry.name.endsWith(".ts") ? [rel] : [];
    });
}

/** Hook keys returned by the plugin entrypoint, resolved through PLUGIN_HOOKS. */
function registeredHooks(): string[] {
    const index = readFileSync(join(SRC_ROOT, "index.ts"), "utf8");
    const constants = readFileSync(join(SRC_ROOT, "shared/message/constants.ts"), "utf8");

    const named: Record<string, string> = {};
    for (const m of constants.matchAll(/([A-Z_]+):\s*"([a-z.]+)"/g)) named[m[1]] = m[2];

    const body = index.slice(index.indexOf("return {"));
    const keys: string[] = [];
    for (const m of body.matchAll(/^ {8}(?:\[PLUGIN_HOOKS\.([A-Z_]+)\]|([a-zA-Z]+)):/gm)) {
        const key = m[1] ? named[m[1]] : m[2];
        if (key) keys.push(key);
    }
    return [...new Set(keys)];
}

/** Hook keys declared by the installed @opencode-ai/plugin. */
function declaredHooks(): string[] {
    const start = PLUGIN_TYPES.indexOf("export interface Hooks");
    expect(start, "Hooks interface not found in @opencode-ai/plugin").toBeGreaterThan(-1);
    return [...new Set(
        [...PLUGIN_TYPES.slice(start).matchAll(/^ {4}"?([a-zA-Z][a-zA-Z0-9.]*)"?\??:/gm)]
            .map(m => m[1]),
    )];
}

/** Every `client.<namespace>.<method>(` the source calls. */
function clientCalls(): string[] {
    const found = new Set<string>();
    for (const rel of sourceFiles()) {
        const src = readFileSync(join(SRC_ROOT, rel), "utf8");
        for (const m of src.matchAll(/\bclient\??\.(\w+)\??\.(\w+)\s*\(/g)) {
            found.add(`${m[1]}.${m[2]}`);
        }
    }
    return [...found].sort();
}

describe("plugin API conformance", () => {
    it("registers only hooks the installed plugin package declares", () => {
        const declared = declaredHooks();
        const mine = registeredHooks();

        expect(mine.length, "no hooks parsed — the scan is broken, not the code")
            .toBeGreaterThan(0);

        const unknown = mine.filter(hook => !declared.includes(hook));
        expect(unknown, `hook keys OpenCode never calls: ${unknown.join(", ")}`).toEqual([]);
    });

    it("calls only SDK client methods that exist", () => {
        const calls = clientCalls();
        expect(calls.length, "no client calls parsed — the scan is broken").toBeGreaterThan(0);

        const missing = calls.filter(call => {
            const method = call.split(".")[1];
            // Declarations look like `status<ThrowOnError extends boolean = false>(`
            // in the generated SDK, and `showToast(` on the TUI surface.
            return !new RegExp(`\\b${method}\\s*[(<]`).test(SDK_TYPES + PLUGIN_TYPES);
        });

        expect(missing, `client methods absent from the SDK: ${missing.join(", ")}`).toEqual([]);
    });

    it("subscribes only to event types OpenCode publishes", () => {
        const constants = readFileSync(join(SRC_ROOT, "shared/session/constants.ts"), "utf8");
        const subscribed = [...new Set(
            [...constants.matchAll(/"((?:session|message)\.[a-z.]+)"/g)].map(m => m[1]),
        )].sort();

        expect(subscribed.length, "no event types parsed — the scan is broken")
            .toBeGreaterThan(0);

        const unpublished = subscribed.filter(ev => !SDK_EVENT_TYPES.includes(`"${ev}"`));
        expect(unpublished, `events OpenCode never emits: ${unpublished.join(", ")}`).toEqual([]);
    });
});
