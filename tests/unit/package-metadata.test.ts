import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface PackageMetadata {
    description?: string;
    version?: string;
    homepage?: string;
    bugs?: {
        url?: string;
    };
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
});
