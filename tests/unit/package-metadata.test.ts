import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");

interface PackageManifest {
    version?: string;
    dependencies?: Record<string, string>;
}

function readManifest(): PackageManifest {
    return JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as PackageManifest;
}

function readCargoWorkspaceVersion(): string {
    const cargoToml = readFileSync(path.join(repoRoot, "Cargo.toml"), "utf8");
    const workspacePackage = cargoToml.match(/\[workspace\.package\]([\s\S]*?)(?:\n\[|$)/);
    const versionMatch = workspacePackage?.[1].match(/version\s*=\s*"([^"]+)"/);
    if (!versionMatch) throw new Error("Cargo.toml [workspace.package] is missing a version field.");
    return versionMatch[1];
}

describe("package metadata", () => {
    // The CLI launcher downloads the release binary for the npm version, so the
    // Rust binary must report the same version.
    it("keeps the Cargo workspace version in sync with the npm package version", () => {
        expect(readCargoWorkspaceVersion()).toBe(readManifest().version);
    });

    // Release binaries are built from the tag; tracked copies go stale.
    it("does not track built binaries under bin/", () => {
        const tracked = execFileSync("git", ["ls-files", "bin"], { cwd: repoRoot, encoding: "utf8" }).trim();
        expect(tracked).toBe("");
    });

    // End users install only "dependencies"; anything else must be bundled or dev-only.
    it("declares zod as the only runtime dependency", () => {
        expect(Object.keys(readManifest().dependencies ?? {})).toEqual(["zod"]);
    });
});
