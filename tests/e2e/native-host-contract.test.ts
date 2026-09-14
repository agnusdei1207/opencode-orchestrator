import { describe, expect, it } from "vitest";

describe("native host QA isolation contract", () => {
    it("excludes inherited credentials and redirects every host storage directory", async () => {
        const { isolatedEnvironment } = await import("../../scripts/qa-native-host.mjs");
        const env = isolatedEnvironment("C:/temporary/qa", {
            PATH: "system-bin", SystemRoot: "C:/Windows", OPENAI_API_KEY: "must-not-inherit",
            OPENCODE_CONFIG: "private-config", AWS_PROFILE: "private", HOME: "private-home",
        });
        expect(env.OPENAI_API_KEY).toBeUndefined();
        expect(env.AWS_PROFILE).toBeUndefined();
        expect(env.OPENCODE_CONFIG).toBeUndefined();
        for (const key of ["HOME", "USERPROFILE", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "APPDATA", "LOCALAPPDATA"])
            expect(env[key].replaceAll("\\", "/")).toMatch(/^C:\/temporary\/qa\//);
        expect(env.SystemRoot).toBe("C:/Windows");
    });

    it("keeps unverified background capabilities visibly excluded", async () => {
        const { unsupportedCapabilities } = await import("../../scripts/qa-native-host.mjs");
        expect(unsupportedCapabilities.nativeBackground.status).toBe("not-adopted");
        expect(unsupportedCapabilities.nativeBackground.reason).toContain("public");
    });

    it("requires an explicit host executable instead of assuming a personal installation", async () => {
        const { requiredExecutable } = await import("../../scripts/qa-native-host.mjs");
        expect(() => requiredExecutable({})).toThrow("OCO_QA_EXECUTABLE");
        expect(requiredExecutable({ OCO_QA_EXECUTABLE: "C:/tools/opencode.exe" })).toBe("C:/tools/opencode.exe");
    });
});
