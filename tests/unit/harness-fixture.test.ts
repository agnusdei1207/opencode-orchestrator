import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { tmpdir, tmpdirSync, createMockFs, waitFor } from "../harness";
import * as fs from "fs";
import * as path from "path";

describe("harness/fixture", () => {
    describe("tmpdir", () => {
        it("creates a temporary directory", async () => {
            await using tmp = await tmpdir();
            expect(tmp.path).toBeDefined();
            expect(tmp.path.length).toBeGreaterThan(0);
            expect(fs.existsSync(tmp.path)).toBe(true);
        });

        it("returns a non-zero extra value", async () => {
            await using tmp = await tmpdir<number>({
                init: async () => 42,
            });
            expect(tmp.extra).toBe(42);
        });

        it("creates opencode.json when config provided", async () => {
            await using tmp = await tmpdir({
                config: { plugin: ["test-plugin"] },
            });
            const configPath = path.join(tmp.path, "opencode.json");
            expect(fs.existsSync(configPath)).toBe(true);
            const content = JSON.parse(fs.readFileSync(configPath, "utf-8"));
            expect(content.plugin).toContain("test-plugin");
        });

        it("initializes git repo when git option is true", async () => {
            await using tmp = await tmpdir({ git: true });
            const gitDir = path.join(tmp.path, ".git");
            expect(fs.existsSync(gitDir)).toBe(true);
        });

        it("cleans up directory on disposal - success path", async () => {
            let dirPath: string;
            await using tmp = await tmpdir();
            dirPath = tmp.path;
            expect(fs.existsSync(dirPath)).toBe(true);
        });

        it("cleans up directory on disposal - error path", async () => {
            let dirPath: string;
            try {
                await using tmp = await tmpdir({
                    init: async () => {
                        throw new Error("init error");
                    },
                });
                dirPath = tmp.path;
                expect.fail("Should have thrown");
            } catch (err) {
                expect((err as Error).message).toBe("init error");
            }
        });

        it("disposes only once even with multiple calls", async () => {
            await using tmp = await tmpdir();
            const dispose1 = tmp[Symbol.asyncDispose]();
            const dispose2 = tmp[Symbol.asyncDispose]();
            await dispose1;
            await dispose2;
        });

        it("creates nested directory structure", async () => {
            await using tmp = await tmpdir({
                init: async (dir) => {
                    const nested = path.join(dir, "a", "b", "c");
                    await fs.promises.mkdir(nested, { recursive: true });
                    return nested;
                },
            });
            expect(fs.existsSync(tmp.extra as string)).toBe(true);
        });
    });

    describe("tmpdirSync", () => {
        it("creates a temporary directory synchronously", () => {
            using tmp = tmpdirSync();
            expect(tmp.path).toBeDefined();
            expect(fs.existsSync(tmp.path)).toBe(true);
        });

        it("disposes directory on sync disposal", () => {
            let dirPath: string;
            using tmp = tmpdirSync();
            dirPath = tmp.path;
            expect(fs.existsSync(dirPath)).toBe(true);
        });

        it("supports custom prefix", () => {
            using tmp = tmpdirSync({ prefix: "my-test-" });
            expect(tmp.path).toContain("my-test-");
        });
    });

    describe("createMockFs", () => {
        it("creates a directory structure", async () => {
            await using tmp = await tmpdir();
            await createMockFs(tmp.path, {
                "file1.txt": "content 1",
                "dir/file2.txt": "content 2",
            });
            expect(fs.existsSync(path.join(tmp.path, "file1.txt"))).toBe(true);
            expect(fs.existsSync(path.join(tmp.path, "dir/file2.txt"))).toBe(true);
        });

        it("creates JSON files from objects", async () => {
            await using tmp = await tmpdir();
            await createMockFs(tmp.path, {
                "config.json": { key: "value" },
            });
            const content = JSON.parse(
                fs.readFileSync(path.join(tmp.path, "config.json"), "utf-8")
            );
            expect(content.key).toBe("value");
        });
    });

    describe("waitFor", () => {
        it("resolves when condition is met", async () => {
            let counter = 0;
            const condition = () => {
                counter++;
                return counter >= 3;
            };
            await waitFor(condition, { timeout: 1000, interval: 10 });
            expect(counter).toBeGreaterThanOrEqual(3);
        });

        it("throws on timeout", async () => {
            const condition = () => false;
            await expect(waitFor(condition, { timeout: 100 })).rejects.toThrow(
                "Timeout waiting for condition"
            );
        });

        it("supports async conditions", async () => {
            let counter = 0;
            const condition = async () => {
                counter++;
                await new Promise((r) => setTimeout(r, 10));
                return counter >= 2;
            };
            await waitFor(condition, { timeout: 1000, interval: 50 });
            expect(counter).toBeGreaterThanOrEqual(2);
        });
    });
});
