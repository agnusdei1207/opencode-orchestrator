import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../..");

function readRepoFile(relativePath: string): string {
    return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("issue #27 release hardening", () => {
    it("builds and validates the Linux x64 artifact in the release workflow", () => {
        const workflow = readRepoFile(".github/workflows/release.yml");

        expect(workflow).toContain("target: x86_64-unknown-linux-gnu");
        expect(workflow).toContain("binary: orchestrator-linux-x64");
        expect(workflow).toContain("Validate Linux x64 artifact architecture");
        expect(workflow).toContain("if: matrix.target == 'x86_64-unknown-linux-gnu'");
        expect(workflow).toContain('grep -F "x86-64"');
    });

    it("validates npm package Linux binaries before publishing", () => {
        const workflow = readRepoFile(".github/workflows/release.yml");
        const validationIndex = workflow.indexOf("Validate NPM Linux binary architectures");
        const publishIndex = workflow.indexOf("npm publish");

        expect(validationIndex).toBeGreaterThan(-1);
        expect(publishIndex).toBeGreaterThan(validationIndex);
        expect(workflow).toContain("file bin/orchestrator-linux-x64");
        expect(workflow).toContain("file bin/orchestrator-linux-arm64");
        expect(workflow).toContain('file bin/orchestrator-linux-x64 | grep -F "x86-64"');
        expect(workflow).toContain('file bin/orchestrator-linux-arm64 | grep -F "ARM aarch64"');
    });

    it("keeps the Docker x64 build pinned to a Linux amd64 target and artifact name", () => {
        const compose = readRepoFile("compose.yml");

        expect(compose).toContain("platform: linux/amd64");
        expect(compose).toContain("rustup target add x86_64-unknown-linux-gnu");
        expect(compose).toContain("cargo build --release --target x86_64-unknown-linux-gnu");
        expect(compose).toContain(
            "cp target/x86_64-unknown-linux-gnu/release/orchestrator bin/orchestrator-linux-x64",
        );
    });

    it("routes local release scripts through Docker Rust artifact rebuilds", () => {
        const packageJson = JSON.parse(readRepoFile("package.json")) as {
            scripts: Record<string, string>;
        };

        expect(packageJson.scripts["docker:rust-dist"]).toContain("docker compose run --rm dev");
        expect(packageJson.scripts["docker:rust-dist"]).toContain("docker compose run --rm rust-arm64");
        expect(packageJson.scripts["release:patch"]).toContain("npm run docker:rust-dist");
        expect(packageJson.scripts["release:minor"]).toContain("npm run docker:rust-dist");
        expect(packageJson.scripts["release:major"]).toContain("npm run docker:rust-dist");
    });
});
