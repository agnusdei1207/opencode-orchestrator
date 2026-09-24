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
    it("pins OpenCode SDK and plugin to the same tested release", () => {
        const manifest = readManifest();
        const pluginVersion = manifest.dependencies?.["@opencode-ai/plugin"];
        const sdkVersion = manifest.dependencies?.["@opencode-ai/sdk"];

        expect(pluginVersion).toBe("1.18.32");
        expect(sdkVersion).toBe("1.18.32");
    });

    it("pins the OpenCode 2 plugin contract used by the hybrid entrypoint", () => {
        const manifest = readManifest();
        expect(manifest.devDependencies?.["@opencode/plugin"]).toBe("2.0.15");
    });

    it("exposes the server entrypoint OpenCode resolves for npm plugins", () => {
        const manifest = readManifest();
        expect(manifest.exports?.["./server"]).toBe("./dist/index.js");
    });

    it("requires the Node.js release supported by the OpenCode dependency graph", () => {
        const manifest = readManifest();
        expect(manifest.engines?.node).toBe(">=24.15.0");
    });
});
