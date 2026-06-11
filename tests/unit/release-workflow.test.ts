import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readReleaseWorkflow(): string {
    return readFileSync(resolve(process.cwd(), ".github/workflows/release.yml"), "utf8");
}

describe("release workflow", () => {
    it("uses current verified action majors", () => {
        const workflow = readReleaseWorkflow();

        expect(workflow).toContain("actions/checkout@v6");
        expect(workflow).toContain("actions/setup-node@v6");
        expect(workflow).toContain("actions/upload-artifact@v7");
        expect(workflow).toContain("actions/download-artifact@v8");
        expect(workflow).toContain("softprops/action-gh-release@v3");
    });

    it("avoids the unused bun setup and deprecated registry inputs", () => {
        const workflow = readReleaseWorkflow();

        expect(workflow).not.toContain("oven-sh/setup-bun");
        expect(workflow).not.toContain("registry-url:");
        expect(workflow).not.toContain("scope:");
        expect(workflow).toContain("Configure GitHub Packages auth");
        expect(workflow).toContain("Configure npm auth");
    });

    it("pins the Windows runner to an explicit supported image", () => {
        const workflow = readReleaseWorkflow();

        expect(workflow).toContain("os: windows-2025");
        expect(workflow).not.toContain("os: windows-latest");
    });
});
