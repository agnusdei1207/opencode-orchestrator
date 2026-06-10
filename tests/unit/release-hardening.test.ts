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
        expect(packageJson.scripts["release:preflight"]).toContain("scripts/release-preflight.mjs");
        expect(packageJson.scripts["release:patch"]).toContain("npm run docker:rust-dist");
        expect(packageJson.scripts["release:minor"]).toContain("npm run docker:rust-dist");
        expect(packageJson.scripts["release:major"]).toContain("npm run docker:rust-dist");
        expect(packageJson.scripts["release:patch"]).toContain("scripts/release-sync-artifacts.mjs");
        expect(packageJson.scripts["release:minor"]).toContain("scripts/release-sync-artifacts.mjs");
        expect(packageJson.scripts["release:major"]).toContain("scripts/release-sync-artifacts.mjs");
        expect(packageJson.scripts["release:patch"]).toContain("scripts/release-auth-check.mjs");
        expect(packageJson.scripts["release:minor"]).toContain("scripts/release-auth-check.mjs");
        expect(packageJson.scripts["release:major"]).toContain("scripts/release-auth-check.mjs");
        expect(packageJson.scripts["release:patch"]).toContain("scripts/release-version.mjs patch");
        expect(packageJson.scripts["release:minor"]).toContain("scripts/release-version.mjs minor");
        expect(packageJson.scripts["release:major"]).toContain("scripts/release-version.mjs major");
        expect(packageJson.scripts["release:patch"]).not.toContain("npm version patch");
        expect(packageJson.scripts.version).toContain("sync-readme-version.mjs --stage");
        expect(packageJson.scripts["release:patch"]).toContain("npm run release:preflight");
        expect(packageJson.scripts["release:minor"]).toContain("npm run release:preflight");
        expect(packageJson.scripts["release:major"]).toContain("npm run release:preflight");
        expect(packageJson.scripts["release:dry-run"]).toContain("--allow-dirty");
        expect(packageJson.scripts["release:dry-run"]).toContain("--skip-version-check");
    });

    it("makes GitHub Actions npm publishing skip-safe and idempotent", () => {
        const workflow = readRepoFile(".github/workflows/release.yml");

        expect(workflow).toContain("NPM_TOKEN: ${{ secrets.NPM_TOKEN }}");
        expect(workflow).toContain("if: env.NPM_TOKEN != ''");
        expect(workflow).toContain("npm view \"${PACKAGE_NAME}@${PACKAGE_VERSION}\" version");
        expect(workflow).toContain("is already published to npm. Skipping.");
        expect(workflow).toContain("if: env.NPM_TOKEN == ''");
        expect(workflow).toContain("NPM_TOKEN secret is not configured; skipping public npm publish.");
    });

    it("keeps local release artifact sync restricted to generated Linux binaries", () => {
        const script = readRepoFile("scripts/release-sync-artifacts.mjs");

        expect(script).toContain("bin/orchestrator-linux-arm64");
        expect(script).toContain("bin/orchestrator-linux-x64");
        expect(script).toContain("Unexpected dirty release paths");
        expect(script).toContain("git\", [\"commit\", \"--amend\", \"--no-edit\"]");
        expect(script).toContain("git\", [\"tag\", \"-f\", `v${readVersion()}`]");
    });

    it("uses cross-platform Node build and clean scripts for local packaging", () => {
        const packageJson = JSON.parse(readRepoFile("package.json")) as {
            scripts: Record<string, string>;
        };

        expect(packageJson.scripts.build).toBe("node scripts/build.mjs");
        expect(packageJson.scripts.build).not.toContain("rm -rf");
        expect(packageJson.scripts.build).not.toContain("mkdir -p");
        expect(packageJson.scripts["release:clean"]).toContain("shx rm -rf dist bin");
    });
});
