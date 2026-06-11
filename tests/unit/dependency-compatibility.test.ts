import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface PackageManifest {
    engines?: {
        node?: string;
    };
    dependencies?: Record<string, string>;
}

function readManifest(): PackageManifest {
    return JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as PackageManifest;
}

describe("dependency compatibility", () => {
    it("pins OpenCode SDK and plugin to the same tested release", () => {
        const manifest = readManifest();
        const pluginVersion = manifest.dependencies?.["@opencode-ai/plugin"];
        const sdkVersion = manifest.dependencies?.["@opencode-ai/sdk"];

        expect(pluginVersion).toBe("1.17.3");
        expect(sdkVersion).toBe("1.17.3");
    });

    it("requires Node.js 24 or newer", () => {
        const manifest = readManifest();
        expect(manifest.engines?.node).toBe(">=24");
    });
});
