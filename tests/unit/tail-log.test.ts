import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
        rmSync(directory, { recursive: true, force: true });
    }
});

describe("development log follower", () => {
    it("prints only the requested trailing lines in one-shot mode", () => {
        const directory = mkdtempSync(join(tmpdir(), "orchestrator-log-test-"));
        temporaryDirectories.push(directory);
        const logFile = join(directory, "plugin.log");
        writeFileSync(logFile, "one\ntwo\nthree\nfour\n", "utf8");

        const result = spawnSync(
            process.execPath,
            [resolve("scripts/tail-log.mjs"), "--once", "--lines", "3"],
            {
                encoding: "utf8",
                env: { ...process.env, OCO_LOG_FILE: logFile },
            }
        );

        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toBe("two\nthree\nfour\n");
    });
});
