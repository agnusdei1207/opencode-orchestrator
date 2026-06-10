import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface PackageMetadata {
    description?: string;
    homepage?: string;
    bugs?: {
        url?: string;
    };
}

function readPackageMetadata(): PackageMetadata {
    return JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as PackageMetadata;
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

        expect(metadata.homepage).toBe(issueURL);
        expect(metadata.bugs?.url).toBe(issueURL);
    });
});
