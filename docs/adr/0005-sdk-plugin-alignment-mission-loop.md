# ADR-0005: SDK/Plugin Alignment and Autonomous Mission Loop

Date: 2026-06-11 00:01 KST
Status: Accepted
Source: `docs/histories/2026/06/10/PLAN_OpenCodeSDKPluginAlignmentAndAutonomousMissionLoop_2026-06-10.md` (removed 2026-09-03; history in git)

## Context

The plugin needed to stay aligned with the official OpenCode SDK/plugin
contract without undocumented assumptions, while strengthening autonomous
mission execution — without giving the model unchecked completion authority.

## Decision

Four outcomes pursued:

1. Keep the plugin boundary aligned with current `@opencode-ai/plugin` and `@opencode-ai/sdk`.
2. Make configuration behavior explicit and test-backed (models, permissions, commands, concurrency).
3. Strengthen the mission loop to monitor the active objective and inject concise, state-aware continuation prompts.
4. Keep documentation polished and understated — enough architecture to explain behavior, not a changelog.

## Consequences

- Test-backed configuration behavior became the norm (see config-schema and
  concurrency tests).
- Continuation-prompt strengthening continued through the mission-loop work
  (stagnation guard, circuit breaker).
