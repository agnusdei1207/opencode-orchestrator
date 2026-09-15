import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface PackageMetadata {
    description?: string;
    version?: string;
    homepage?: string;
    bin?: Record<string, string>;
    scripts?: Record<string, string>;
    files?: string[];
    bugs?: {
        url?: string;
    };
}

function readCargoWorkspaceLicense(): string {
    const cargoToml = readFileSync(resolve(process.cwd(), "Cargo.toml"), "utf8");
    const workspacePackage = cargoToml.match(/\[workspace\.package\]([\s\S]*?)(?:\n\[|$)/);
    const licenseMatch = workspacePackage?.[1].match(/license\s*=\s*"([^"]+)"/);
    if (!licenseMatch) throw new Error("Cargo.toml is missing the workspace package license.");
    return licenseMatch[1];
}

function readPackageMetadata(): PackageMetadata {
    return JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as PackageMetadata;
}

function readCargoWorkspaceVersion(): string {
    const cargoToml = readFileSync(resolve(process.cwd(), "Cargo.toml"), "utf8");
    const workspacePackage = cargoToml.match(/\[workspace\.package\]([\s\S]*?)(?:\n\[|$)/);
    if (!workspacePackage) {
        throw new Error("Cargo.toml is missing the [workspace.package] section.");
    }
    const versionMatch = workspacePackage[1].match(/version\s*=\s*"([^"]+)"/);
    if (!versionMatch) {
        throw new Error("Cargo.toml [workspace.package] is missing a version field.");
    }
    return versionMatch[1];
}

describe("package metadata", () => {
    it("describes the actual four-agent architecture", () => {
        const metadata = readPackageMetadata();

        expect(metadata.description).toContain("Commander");
        expect(metadata.description).toContain("Planner");
        expect(metadata.description).toContain("Worker");
        expect(metadata.description).toContain("Reviewer");
        expect(metadata.description).not.toContain("Coder");
    });

    it("routes public support links to GitHub issues", () => {
        const metadata = readPackageMetadata();
        const issueURL = "https://github.com/agnusdei1207/opencode-orchestrator/issues";

        expect(metadata.homepage).toBe("https://agnusdei1207.github.io/opencode-orchestrator/");
        expect(metadata.bugs?.url).toBe(issueURL);
    });

    it("keeps the Cargo workspace version in sync with the npm package version", () => {
        const metadata = readPackageMetadata();
        const cargoVersion = readCargoWorkspaceVersion();

        expect(metadata.version).toBeDefined();
        expect(cargoVersion).toBe(metadata.version);
    });

    it("uses the repository MIT license for npm and Cargo packages", () => {
        const metadata = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as { license?: string };
        expect(readFileSync(resolve(process.cwd(), "LICENSE"), "utf8")).toContain("MIT License");
        expect(metadata.license).toBe("MIT");
        expect(readCargoWorkspaceLicense()).toBe("MIT");
    });

    it("exposes the documented orchestrator CLI through the built launcher", () => {
        const metadata = readPackageMetadata();

        expect(metadata.bin).toEqual({ orchestrator: "dist/cli.js" });
    });

    it("tails the development log through the cross-platform Node helper", () => {
        const metadata = readPackageMetadata();

        expect(metadata.scripts?.log).toBe("node scripts/tail-log.mjs");
        expect(metadata.files).toContain("scripts/tail-log.mjs");
    });
});
