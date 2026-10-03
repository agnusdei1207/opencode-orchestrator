import { describe, expect, it } from "vitest";
import { z } from "zod";
import { httpTool } from "../../src/tools/search.js";

describe("http tool schema", () => {
    it("advertises headers as a string map the model can fill", () => {
        const args = httpTool().args;
        const schema = z.toJSONSchema(z.object(args)) as { properties: Record<string, Record<string, unknown>> };

        expect(schema.properties.headers).toMatchObject({
            type: "object",
            additionalProperties: { type: "string" },
        });
        expect(z.object(args).parse({
            url: "https://example.com",
            headers: { Accept: "application/json" },
        }).headers).toEqual({ Accept: "application/json" });
    });
});
