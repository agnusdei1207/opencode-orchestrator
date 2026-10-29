import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface PackageManifest {
    engines?: {
        node?: string;
    };
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    exports?: Record<string, unknown>;
}

function readManifest(): PackageManifest {
    return JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as PackageManifest;
}

describe("dependency compatibility", () => {
    it("pins the OpenCode 2 plugin contract used by the entrypoint", () => {
        const manifest = readManifest();
        expect(manifest.devDependencies?.["@opencode/plugin"]).toBe("2.0.22");
    });

    it("exposes only the root package entrypoint OpenCode 2 resolves", () => {
        const manifest = readManifest();
        expect(Object.keys(manifest.exports ?? {})).toEqual(["."]);
    });

    it("requires the Node.js release supported by the OpenCode dependency graph", () => {
        const manifest = readManifest();
        expect(manifest.engines?.node).toBe(">=24.15.0");
    });
});
