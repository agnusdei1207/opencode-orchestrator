import { randomBytes } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Replace a file via a sibling temp file and rename, so readers never see a
 * torn write. The temp name is unique per call because several OpenCode
 * processes can share one workspace.
 */
export function atomicWrite(path: string, content: string): void {
    mkdirSync(dirname(path), { recursive: true });
    const tempPath = `${path}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    try {
        writeFileSync(tempPath, content, "utf8");
        renameSync(tempPath, path);
    } catch (error) {
        rmSync(tempPath, { force: true });
        throw error;
    }
}

export function escapeYaml(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
