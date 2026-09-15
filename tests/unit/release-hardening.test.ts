import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

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

    it("assembles and validates every npm binary before publishing", () => {
        const workflow = readRepoFile(".github/workflows/release.yml");
        const validationIndex = workflow.indexOf("Verify release artifacts");
        const publishIndex = workflow.indexOf("npm publish");

        expect(validationIndex).toBeGreaterThan(-1);
        expect(publishIndex).toBeGreaterThan(validationIndex);
        expect(workflow).toContain("node scripts/verify-release-artifacts.mjs");
        for (const artifact of [
            "orchestrator-linux-x64",
            "orchestrator-linux-arm64",
            "orchestrator-macos-x64",
            "orchestrator-macos-arm64",
            "orchestrator-windows-x64.exe",
        ]) {
            expect(workflow).toContain(`binaries/${artifact}/${artifact}`);
        }
    });

    it("builds versioned binaries from the tag instead of tracking stale artifacts", () => {
        const trackedBinaries = execFileSync("git", ["ls-files", "bin"], {
            cwd: repoRoot,
            encoding: "utf8",
        }).trim();
        const gitignore = readRepoFile(".gitignore");

        expect(trackedBinaries).toBe("");
        expect(gitignore).toMatch(/^bin\/$/m);
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

    it("routes release commands through the hosted all-platform artifact matrix", () => {
        const packageJson = JSON.parse(readRepoFile("package.json")) as {
            scripts: Record<string, string>;
        };

        expect(packageJson.scripts["docker:rust-dist"]).toContain("docker compose run --rm dev");
        expect(packageJson.scripts["docker:rust-dist"]).toContain("docker compose run --rm rust-arm64");
        expect(packageJson.scripts["release:preflight"]).toContain("scripts/release-preflight.mjs");
        for (const bump of ["patch", "minor", "major"]) {
            const release = packageJson.scripts[`release:${bump}`];
            expect(release).toContain(`scripts/release-version.mjs ${bump}`);
            expect(release).toContain("npm run release:preflight");
            expect(release).toContain("npm run release:push");
            expect(release).not.toContain("npm publish");
            expect(release).not.toContain("docker:rust-dist");
            expect(release).not.toContain("release-sync-artifacts");
            expect(release).not.toContain("release-auth-check");
        }
        expect(packageJson.scripts["release:push"]).toBe("node scripts/release-push.mjs");
        expect(packageJson.scripts.version).toContain("sync-readme-version.mjs --stage");
        expect(packageJson.scripts["release:dry-run"]).toContain("--allow-dirty");
        expect(packageJson.scripts["release:dry-run"]).toContain("--skip-version-check");
        expect(packageJson.scripts["docker:rust-dist"]).not.toContain("sudo");
        expect(packageJson.scripts["docker:rust-dist"]).not.toContain("$(");
        expect(packageJson.scripts["reset:local"]).toBeUndefined();
        expect(packageJson.scripts["reset:prod"]).toBeUndefined();
    });

    it("has one release implementation and installs the lockfile deterministically", () => {
        const compose = readRepoFile("compose.yml");
        const workflow = readRepoFile(".github/workflows/release.yml");

        expect(compose).not.toContain("npm-release:");
        expect(workflow).toContain("uses: actions/checkout@v7");
        expect(workflow).toContain("uses: actions/setup-node@v7");
        expect(workflow).not.toContain("uses: actions/checkout@v6");
        expect(workflow).not.toContain("uses: actions/setup-node@v6");
        expect(workflow).toContain("run: npm ci");
        expect(workflow).not.toContain("npm install --force");
    });

    it("falls back to Docker Rust tests when local cargo is unavailable", () => {
        const preflight = readRepoFile("scripts/release-preflight.mjs");

        expect(preflight).toContain('commandIsAvailable("cargo", ["--version"])');
        expect(preflight).toContain('["fmt", "--all", "--", "--check"]');
        expect(preflight).toContain('["clippy", "--workspace", "--all-targets", "--", "-D", "warnings"]');
        expect(preflight).toContain('["test", "--workspace", "--all-targets"]');
        expect(preflight).toContain('"test", "sh", "-c"');
        expect(preflight).toContain("rustup component add rustfmt clippy");
    });

    it("gates local and hosted releases on full quality checks", () => {
        const preflight = readRepoFile("scripts/release-preflight.mjs");
        const workflow = readRepoFile(".github/workflows/release.yml");

        expect(preflight).toContain('runNpm(["run", "test:coverage"])');
        expect(workflow).toContain("qa:");
        expect(workflow).toContain("npm run test:coverage");
        expect(workflow).toContain("cargo fmt --all -- --check");
        expect(workflow).toContain("cargo clippy --workspace --all-targets -- -D warnings");
        expect(workflow).toContain("cargo test --workspace --all-targets");
        expect(workflow).toContain("needs: [qa, build]");
        expect(workflow).toContain("node scripts/package-smoke.mjs");
        expect(preflight).toContain('"scripts/package-smoke.mjs", "--skip-cli"');
    });

    it("avoids invoking the Windows npm command shim directly", () => {
        const preflight = readRepoFile("scripts/release-preflight.mjs");

        expect(preflight).toContain('process.platform === "win32" ? process.execPath : "npm"');
        expect(preflight).toContain("return run(npmCommand, [...npmCommandPrefix, ...commandArgs], options)");
        expect(preflight).not.toContain('? "npm.cmd" : "npm"');
    });

    it("makes the single npm package publishing path idempotent and complete", () => {
        const workflow = readRepoFile(".github/workflows/release.yml");

        expect(workflow).toContain("if: startsWith(github.ref, 'refs/tags/v')");
        expect(workflow).toContain("Verify tag matches package version");
        expect(workflow).toContain('test "${GITHUB_REF_NAME}" = "v${PACKAGE_VERSION}"');
        expect(workflow).toContain("NPM_TOKEN: ${{ secrets.NPM_TOKEN }}");
        expect(workflow).toContain("if: env.NPM_TOKEN != ''");
        expect(workflow).toContain("npm view \"${PACKAGE_NAME}@${PACKAGE_VERSION}\" version");
        expect(workflow).toContain("is already published to npm. Skipping.");
        expect(workflow).toContain("if: env.NPM_TOKEN == ''");
        expect(workflow).toContain("NPM_TOKEN secret is required for a complete public release.");
        expect(workflow).not.toContain("npm.pkg.github.com");
        expect(workflow).not.toContain("Publish to GitHub Registry");
        expect(workflow).not.toContain("packages: write");
        expect(workflow).not.toContain("skipping public npm publish");
    });

    it("atomically pushes only main and the package version tag", () => {
        const script = readRepoFile("scripts/release-push.mjs");

        expect(script).toContain('["push", "--atomic", "origin", expectedBranch, `refs/tags/${tag}`]');
        expect(script).not.toContain("--tags");
    });

    it("fails the GitHub release if the validated artifact glob becomes empty", () => {
        const workflow = readRepoFile(".github/workflows/release.yml");

        expect(workflow).toContain("fail_on_unmatched_files: true");
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
