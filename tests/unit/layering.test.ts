import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Layering guard (Builder learning, Phase H).
 *
 * `src/shared` is the contracts/definitions layer. It must not depend upward on
 * `src/core` (the coordination layer). This test fails on any NEW shared->core
 * import so the boundary cannot silently erode.
 *
 * Two legacy implementation files currently live under shared/ and import core;
 * they are allowlisted as known debt to migrate, not as permission for more.
 */
const SHARED_ROOT = path.resolve(__dirname, "../../src/shared");

const ALLOWLIST = new Set([
    "lifecycle/shutdown-manager.ts",
    "notification/presets.ts",
]);

// Matches a relative import that climbs out of src/shared into src/core,
// e.g. "../../core/..." or "../../../core/...".
const SHARED_TO_CORE = /from\s+["'](?:\.\.\/){2,}core\//;

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(full);
    }
    return out;
}

describe("module layering", () => {
    it("src/shared does not import src/core (except known legacy debt)", () => {
        const offenders: string[] = [];
        for (const file of walk(SHARED_ROOT)) {
            const rel = path.relative(SHARED_ROOT, file).split(path.sep).join("/");
            if (ALLOWLIST.has(rel)) continue;
            if (SHARED_TO_CORE.test(readFileSync(file, "utf8"))) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });

    it("does not expose shell session control through model-callable tools", () => {
        const registry = readFileSync(path.resolve(__dirname, "../../src/tools/registry.ts"), "utf8");
        const toolNames = readFileSync(
            path.resolve(__dirname, "../../src/shared/tool/tool-names.ts"),
            "utf8"
        );
        const forbidden = [
            "shell_session",
            "shell-session",
            "shell_listener",
            "shell-listener",
            "session_control",
            "pty_upgrade",
        ];

        for (const token of forbidden) {
            expect(registry).not.toContain(token);
            expect(toolNames).not.toContain(token);
        }
    });
});
