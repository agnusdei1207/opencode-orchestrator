import { describe, expect, it, beforeEach } from "vitest";
import {
    classifyIntent,
    setRouterDecision,
    consumeRouterDecision,
    clearRouterDecision,
    isRouterEnabled,
    FULL_DECISION,
    ROUTER_CONFIG,
    type RouterSignals,
} from "../../src/core/router/intent-router";

const NO_MISSION: RouterSignals = { missionActive: false, sessionActive: false, isSlashCommand: false };

describe("classifyIntent — no mission active", () => {
    it("routes a short question to MINIMAL/simple-qa", () => {
        const d = classifyIntent("뭐야?", NO_MISSION);
        expect(d.intent).toBe("simple-qa");
        expect(d.profile).toBe("MINIMAL");
        expect(d.needs).toEqual(["rag"]);
    });

    it("routes a code edit request to FULL/code-edit", () => {
        const d = classifyIntent("fix the bug in src/foo.ts handleClick function", NO_MISSION);
        expect(d.intent).toBe("code-edit");
        expect(d.profile).toBe("FULL");
        expect(d.needs).toContain("active-session");
    });

    it("routes a planning request to STANDARD/planning", () => {
        const d = classifyIntent("이 기능의 전체 설계 방향을 어떻게 잡을지 같이 정리해보자 길게", NO_MISSION);
        expect(d.intent).toBe("planning");
        expect(d.profile).toBe("STANDARD");
    });

    it("escalates a low-confidence default one tier (still STANDARD, conf 0.6 floor handled)", () => {
        const d = classifyIntent("음 그냥 이런저런 이야기 좀 더 해보자 어쩌고 저쩌고 길게 늘여서", NO_MISSION);
        // default branch conf 0.6 < 0.7 → escalate STANDARD→FULL
        expect(d.profile).toBe("FULL");
    });
});

describe("classifyIntent — mission active", () => {
    const MISSION: RouterSignals = { missionActive: true, sessionActive: false, isSlashCommand: false };

    it("floors a short question to STANDARD (never MINIMAL during a mission)", () => {
        const d = classifyIntent("이거 왜 이래?", MISSION);
        expect(d.intent).toBe("simple-qa");
        expect(d.profile).toBe("STANDARD");
    });

    it("routes a code turn to FULL", () => {
        const d = classifyIntent("update src/index.ts to export the router", MISSION);
        expect(d.profile).toBe("FULL");
        expect(d.intent).toBe("mission-step");
    });

    it("routes an active-session turn to FULL", () => {
        const d = classifyIntent("계속 진행해줘", { ...MISSION, sessionActive: true });
        expect(d.profile).toBe("FULL");
    });

    it("routes a generic mission turn to STANDARD", () => {
        const d = classifyIntent("진행 상황 요약해줘 그리고 다음 단계 정리", MISSION);
        expect(d.intent).toBe("mission-step");
        expect(d.profile).toBe("STANDARD");
    });
});

describe("classifyIntent — slash command", () => {
    it("always routes slash commands to FULL", () => {
        const d = classifyIntent("/task do something", { ...NO_MISSION, isSlashCommand: true });
        expect(d.profile).toBe("FULL");
        expect(d.confidence).toBeGreaterThanOrEqual(0.9);
    });
});

describe("profile → needs invariants", () => {
    it("MINIMAL excludes scratchpad / active-session / background", () => {
        const d = classifyIntent("왜?", NO_MISSION);
        expect(d.needs).not.toContain("scratchpad");
        expect(d.needs).not.toContain("active-session");
        expect(d.needs).not.toContain("background");
    });

    it("FULL_DECISION injects all auxiliary blocks", () => {
        expect(FULL_DECISION.needs).toEqual(["rag", "scratchpad", "active-session", "background"]);
        expect(FULL_DECISION.source).toBe("fallback");
    });

    it("respects the configured short-prompt threshold", () => {
        const longQuestion = "왜 " + "그래".repeat(80) + "?";
        expect(longQuestion.length).toBeGreaterThan(ROUTER_CONFIG.shortPromptThreshold);
        const d = classifyIntent(longQuestion, NO_MISSION);
        // too long for simple-qa MINIMAL → falls through to default STANDARD→escalate
        expect(d.intent).not.toBe("simple-qa");
    });
});

describe("consume-once decision store", () => {
    beforeEach(() => clearRouterDecision("s1"));

    it("returns the stored decision exactly once", () => {
        const d = classifyIntent("뭐야?", NO_MISSION);
        setRouterDecision("s1", d);
        expect(consumeRouterDecision("s1")).toEqual(d);
        expect(consumeRouterDecision("s1")).toBeNull();
    });

    it("returns null for an unknown session (→ caller uses FULL)", () => {
        expect(consumeRouterDecision("never-set")).toBeNull();
    });

    it("ignores empty session ids", () => {
        setRouterDecision("", FULL_DECISION);
        expect(consumeRouterDecision("")).toBeNull();
    });
});

describe("feature flag", () => {
    it("is enabled by default and disabled via env", () => {
        const prev = process.env.ORCHESTRATOR_ROUTER_DISABLED;
        delete process.env.ORCHESTRATOR_ROUTER_DISABLED;
        expect(isRouterEnabled()).toBe(true);
        process.env.ORCHESTRATOR_ROUTER_DISABLED = "1";
        expect(isRouterEnabled()).toBe(false);
        if (prev === undefined) delete process.env.ORCHESTRATOR_ROUTER_DISABLED;
        else process.env.ORCHESTRATOR_ROUTER_DISABLED = prev;
    });
});
