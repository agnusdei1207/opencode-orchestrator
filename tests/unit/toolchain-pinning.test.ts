import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");

function read(relativePath: string): string {
    return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("build toolchain pinning", () => {
    it("uses the current Checkout major in every GitHub workflow", () => {
        const workflowRoot = path.join(repoRoot, ".github", "workflows");
        const workflows = readdirSync(workflowRoot)
            .filter(file => file.endsWith(".yml"))
            .map(file => readFileSync(path.join(workflowRoot, file), "utf8"));

        for (const workflow of workflows) {
            for (const checkout of workflow.matchAll(/actions\/checkout@v\d+/g)) {
                expect(checkout[0]).toBe("actions/checkout@v7");
            }
        }
    });

    it("pins local and hosted Rust builds to stable 1.98.1", () => {
        for (const file of ["Dockerfile", "Dockerfile.windows", "compose.yml", "scripts/dbuild.ps1"]) {
            const content = read(file);
            expect(content).toContain("rust:1.98.1-bookworm");
            expect(content).not.toContain("rust:1.92-bookworm");
        }

        for (const file of [".github/workflows/ci.yml", ".github/workflows/release.yml"]) {
            const content = read(file);
            const setupCount = [...content.matchAll(/uses: dtolnay\/rust-toolchain@stable/g)].length;
            const pinCount = [...content.matchAll(/toolchain: 1\.98\.1/g)].length;
            expect(pinCount).toBe(setupCount);
        }
    });

    it("runs the same complete Rust checks in CI and release QA", () => {
        const ci = read(".github/workflows/ci.yml");

        expect(ci).toContain("cargo fmt --all -- --check");
        expect(ci).toContain("cargo clippy --workspace --all-targets -- -D warnings");
        expect(ci).toContain("cargo test --workspace --all-targets");
    });
});
