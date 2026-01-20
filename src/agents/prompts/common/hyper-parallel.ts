import { PROMPT_TAGS } from "../../../shared/index.js";

/**
 * HPFA (Hyper-Parallel Fractal Architecture) Guidelines
 */
export const HYPER_PARALLEL_ENFORCEMENT = `${PROMPT_TAGS.QUALITY_CHECKLIST.open}
🚀 HYPER-PARALLEL COGNITIVE ARCHITECTURE (HPFA)

To achieve maximum velocity, you MUST leverage these advanced parallel execution patterns:

### 1. Fractal Self-Delegation (Recursive Scaling)
If you are a Worker and your assigned task is complex (e.g., implementing multiple endpoints, refactoring several files), **do not do it sequentially**.
-   **Spawn Sub-Workers**: Use \`delegate_task\` to launch sub-agents for independent sub-components.
-   **Fractal Depth**: You can scale down to any depth. Each worker acts as a local coordinator for its sub-workers.
-   **Context Sharding**: Give each sub-worker a focused, atomic prompt and relevant file context.

### 2. Speculative Racing (Competitive Implementation)
When faced with a high-uncertainty problem (bug fixing, complex refactoring with multiple possible approaches):
-   **Launch a Race**: Spawn multiple Workers (\`mode: "race"\`) with slightly different prompts or strategies.
-   **Winning Criteria**: The first agent to produce a solution that passes unit tests "wins".
-   **Efficiency**: This eliminates the "try-fail-repeat" loop by trying all likely solutions simultaneously.

### 3. Asynchronous Batching
When you need to perform many independent reads or metadata checks:
-   **Batch Operations**: Group your tool calls to trigger massive parallel execution host-side.
-   **Avoid Serial Bottlenecks**: Never wait for a tool result if you have other independent tasks you could be launching in parallel.

### 4. Barrier-Sync Integrated Pipeline (BSIP)
Don't wait for all workers to finish before starting reviews:
-   **Pipelined Verification**: Immediately spawn a Reviewer task as soon as a Worker finishes its individual sub-task. The review of Module A happens while Module B is still being built.
-   **Synchronization Point**: Use the "Final Sync Barrier" to wait for all parallel implementation AND individual reviews to complete.
-   **Global Integration**: The final master Reviewer only acts once all individual units have been verified by their respective sub-reviewers.

### 5. Real-time Brain Sync
As you work in a parallel session, log your critical findings or discovered interface changes to the shared task log. 
Assume that:
-   **Global Awareness**: Other workers are aware of your public findings.
-   **Consistency**: You must check for "Global Context Updates" to ensure your parallel work aligns with the latest state of the system.
${PROMPT_TAGS.QUALITY_CHECKLIST.close}`;
