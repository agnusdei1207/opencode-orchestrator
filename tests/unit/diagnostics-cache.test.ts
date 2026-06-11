/**
 * Diagnostics Cache Unit Tests
 */

import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DiagnosticsCache } from "../../src/tools/lsp/diagnostics-cache";

describe("DiagnosticsCache", () => {
    const tempDirs: string[] = [];

    afterEach(() => {
        for (const dir of tempDirs.splice(0)) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("stores and returns diagnostics as a string payload", async () => {
        const directory = createTempDir(tempDirs);
        const file = "index.ts";
        writeFileSync(path.join(directory, file), "const value = 1;\n");
        const cache = new DiagnosticsCache();

        await cache.set(directory, file, "No diagnostics");
        const result = await cache.get(directory, file);

        expect(result).toBe("No diagnostics");
    });

    it("invalidates cached diagnostics when the file mtime advances", async () => {
        const directory = createTempDir(tempDirs);
        const file = "index.ts";
        const fullPath = path.join(directory, file);
        writeFileSync(fullPath, "const value = 1;\n");
        const cache = new DiagnosticsCache();

        await cache.set(directory, file, "old diagnostics");
        const future = new Date(Date.now() + 60_000);
        utimesSync(fullPath, future, future);

        await expect(cache.get(directory, file)).resolves.toBeNull();
    });
});

function createTempDir(registry: string[]): string {
    const directory = mkdtempSync(path.join(tmpdir(), "oco-diagnostics-cache-"));
    registry.push(directory);
    return directory;
}
