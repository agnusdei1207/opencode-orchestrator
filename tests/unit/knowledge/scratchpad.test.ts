import { describe, it, expect, beforeEach } from "vitest";
import { Scratchpad } from "../../../src/core/knowledge/scratchpad";

describe("Scratchpad - Volatile Key-Value Register Cache", () => {
    let pad: Scratchpad;

    beforeEach(() => {
        pad = new Scratchpad();
    });

    it("should store and retrieve a value by key", () => {
        pad.set("task", "implement hybrid search");
        expect(pad.get("task")).toBe("implement hybrid search");
    });

    it("should return undefined for missing keys", () => {
        expect(pad.get("nonexistent")).toBeUndefined();
    });

    it("should delete a specific key and return true, or false if missing", () => {
        pad.set("temp", "value");
        expect(pad.delete("temp")).toBe(true);
        expect(pad.get("temp")).toBeUndefined();
        expect(pad.delete("temp")).toBe(false);
    });

    it("should clear all entries", () => {
        pad.set("a", "1");
        pad.set("b", "2");
        pad.clear();

        expect(pad.getAll().size).toBe(0);
        expect(pad.get("a")).toBeUndefined();
    });

    it("should return a snapshot of all entries via getAll", () => {
        pad.set("x", "10");
        pad.set("y", "20");

        const all = pad.getAll();
        expect(all.get("x")).toBe("10");
        expect(all.get("y")).toBe("20");
        expect(all.size).toBe(2);

        // Verify it is a snapshot, not a live reference
        all.set("z", "30");
        expect(pad.get("z")).toBeUndefined();
    });

    it("should enforce LRU eviction when exceeding 64 entries", () => {
        for (let i = 0; i < 64; i++) {
            pad.set(`key-${i}`, `value-${i}`);
        }
        expect(pad.getAll().size).toBe(64);

        // Adding the 65th entry should evict key-0 (oldest)
        pad.set("key-64", "value-64");
        expect(pad.getAll().size).toBe(64);
        expect(pad.get("key-0")).toBeUndefined();
        expect(pad.get("key-64")).toBe("value-64");
    });

    it("should refresh LRU position on get access", () => {
        for (let i = 0; i < 64; i++) {
            pad.set(`key-${i}`, `value-${i}`);
        }

        // Access key-0 to refresh it — it should survive the next eviction
        pad.get("key-0");

        // Adding a new entry should evict key-1 (now the oldest)
        pad.set("key-64", "value-64");
        expect(pad.get("key-0")).toBe("value-0");
        expect(pad.get("key-1")).toBeUndefined();
    });

    it("should truncate values exceeding 4KB", () => {
        const longValue = "x".repeat(5000);
        pad.set("big", longValue);

        const stored = pad.get("big");
        expect(stored).toBeDefined();
        expect(stored!.length).toBe(4096);
    });

    it("should serialize to markdown and deserialize back identically", () => {
        pad.set("agent-task", "Plan the next sprint");
        pad.set("context", "Working on knowledge graph modules");

        const markdown = pad.serialize();
        expect(markdown).toContain("# Scratchpad Registers");
        expect(markdown).toContain("## agent-task");
        expect(markdown).toContain("Plan the next sprint");

        // Deserialize into a fresh scratchpad
        const pad2 = new Scratchpad();
        pad2.deserialize(markdown);

        expect(pad2.get("agent-task")).toBe("Plan the next sprint");
        expect(pad2.get("context")).toBe("Working on knowledge graph modules");
    });

    it("should handle deserializing empty or malformed markdown gracefully", () => {
        pad.deserialize("");
        expect(pad.getAll().size).toBe(0);

        pad.deserialize("just some random text without headers");
        expect(pad.getAll().size).toBe(0);
    });
});
