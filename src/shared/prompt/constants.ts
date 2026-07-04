/**
 * Prompt constants (consolidated)
 */
import { AGENT_NAMES } from "../agent/index.js";
import { PATHS } from "../core/constants.js";
import { STATUS_LABEL } from "../core/constants.js";

/**
 * Architecture Rules - Core system behavior constants
 * 
 * These define the immutable rules about agent hierarchy and spawning.
 * Used by prompts to ensure consistent messaging across all agents.
 */



/**
 * Terminal node messaging - used in forbidden actions
 */
export const TERMINAL_NODE = {
    /** Label for terminal node concept */
    LABEL: "TERMINAL node",
    /** Reason why terminal nodes can't spawn */
    REASON: "prevents infinite recursion",
    /** What to do instead of spawning */
    ALTERNATIVE: `Report back to ${AGENT_NAMES.COMMANDER} with specific blockers`,
} as const;

/**
 * Spawning restriction messages
 */
export const SPAWNING_RULES = {
    /** Who can spawn */
    SPAWNER_ONLY: `${AGENT_NAMES.COMMANDER} is the ONLY agent who can spawn other agents`,
    /** What terminal nodes should do */
    TERMINAL_BEHAVIOR: `Complete your assigned task directly without delegation`,
    /** Error message for blocked spawn attempts */
    BLOCKED_MESSAGE: `You are a ${TERMINAL_NODE.LABEL} - ${TERMINAL_NODE.REASON}`,
} as const;

/**
 * Architectural Mandates - Immutable Core Logic
 * 
 * These constants define the non-negotiable architectural requirements
 * that ensure the orchestrator operates according to the verified diagram.
 */


/**
 * Phase 0: Direct Discovery
 */
export const PHASE_0_DIRECT_DISCOVERY = `**Direct Project Discovery**:
 0. **FRESH START**: If ${PATHS.TODO} exists, read it to understand progress. If starting a new project, create it.
 1. **STRUCTURE**: Deeply map project layout (\`ls -la\`, \`find\`).
 2. **ENVIRONMENT**: Identify build/test/lint commands by reading config files (package.json, Cargo.toml, pyproject.toml, etc.).
 3. **FRONTIER**: Identify the "Verification Frontier" (CI/CD workflows, Makefile, docker-compose).
 4. **CONSOLIDATE**: Sync all environmental findings to ${PATHS.CONTEXT}.`;

/**
 * Phase 1: THINK (Strategic Mandate)
 */
export const PHASE_1_THINK_ANALYSIS = `### 1.1 ANALYZE & SCOPE
- **Define FULL scope** based on user request and discovered context.
- **Hierarchical Breakdown**: Milestones -> Tasks -> Sub-tasks.

### 1.2 STRATEGIC DECOMPOSITION
- **Independent Items**: Identify what can run in parallel.
- **Dependency Map**: Clearly define \`depends:\` links.

### 1.3 DELEGATION
- **Parallel Workers**: Assign workers for independent branches.
- **Granular Review**: Assign reviewers for verification.`;

/**
 * Phase 5: MSVP (Multi-Stage Verification Pipeline)
 */
export const PHASE_5_MSVP = `1. **UNIT VERIFICATION**: Every sub-task must be verified by tool output.
2. **HIERARCHICAL ROLL-UP**: A task is complete only when all its sub-tasks pass.
3. **AUTONOMOUS COMPLETION**: No stopping until every \`[ ]\` in ${PATHS.TODO} is converted to \`[x]\`.
4. **LOOP PERSISTENCE**: The system will automatically restart this session if work remains.`;

/**
 * HPFA (Hyper-Parallel Fractal Architecture) Rules
 */
export const HPFA_RULES = `1. **Commander-Only Spawning**: All agents are spawned by the Commander.
2. **Parallel Branches**: Execute non-dependent milestones/tasks simultaneously.
3. **Recursive Breakdown**: Continue subdividing until tasks are atomic.
4. **Autonomous Termination**: You only finish when the verification checklist and TODOs are 100% complete.`;

/**
 * Autonomous Completion Mandate
 */
export const AUTONOMOUS_MANDATE = `
## AUTONOMOUS COMPLETION MANDATE (MANDATORY)
1. **ZERO TOLERANCE**: Finishing with incomplete \`[ ]\` items is a FAILURE.
2. **FORCED CONTINUATION**: If you stop prematurely, the system will inject a "CONTINUE" prompt and iteration count.
3. **HIERARCHICAL PROOF**: You must provide evidence (tool output) for every \`[x]\` mark.
4. **NO PERMISSION**: Do not ask "Should I continue?". The answer is always YES until \`.opencode/todo.md\` is 100% checked.
`;

/**
 * Core Philosophy Phases
 * 
 * The 4-phase cycle: Explore → Learn → Adapt → Act
 */

export const PHILOSOPHY_PHASES = {
    EXPLORE: "EXPLORE",
    LEARN: "LEARN",
    ADAPT: "ADAPT",
    ACT: "ACT",
} as const;

/**
 * Execution Cycle Phases
 * 
 * The 4-step execution pattern: THINK → ACT → OBSERVE → ADJUST
 */
export const EXECUTION_CYCLE = {
    THINK: "THINK",
    ACT: "ACT",
    OBSERVE: "OBSERVE",
    ADJUST: "ADJUST",
} as const;

export const EXECUTION_CYCLE_STEPS = `1. ${EXECUTION_CYCLE.THINK} - Reason about the task
2. ${EXECUTION_CYCLE.ACT} - Execute the work
3. ${EXECUTION_CYCLE.OBSERVE} - Check the result
4. ${EXECUTION_CYCLE.ADJUST} - Fix if needed`;

/**
 * Core philosophy tagline
 */
export const PHILOSOPHY_TAGLINE = "Explore → Learn → Adapt → Act";
export const PHILOSOPHY_QUOTE = "Like an astronaut landing on unknown planets — never assume, always discover.";
export const PHILOSOPHY_LEARN_PRINCIPLE = "LEARN = DOCUMENT: What you discover, you record. Your learnings become the team's knowledge.";


/**
 * Work Status Constants
 * 
 * All status values used in work-log.md, todo.md, sync-issues.md, status.md.
 */


export const WORK_STATUS = {
    // File action types
    ACTION: {
        CREATE: "CREATE",
        MODIFY: "MODIFY",
        DELETE: "DELETE",
        FIX: "FIX",
    },

    // Task/file status (Internal state)
    STATUS: {
        PENDING: STATUS_LABEL.PENDING,
        IN_PROGRESS: STATUS_LABEL.IN_PROGRESS,
        DONE: STATUS_LABEL.DONE,
        FAILED: STATUS_LABEL.FAILED,
    },

    // Test result
    TEST_RESULT: {
        PASS: STATUS_LABEL.PASS,
        FAIL: STATUS_LABEL.FAIL,
        SKIP: STATUS_LABEL.SKIP,
    },

    // E2E integration test status
    E2E_STATUS: {
        NOT_STARTED: "NOT_STARTED",
        RUNNING: STATUS_LABEL.RUNNING,
        PASS: STATUS_LABEL.PASS,
        FAIL: STATUS_LABEL.FAIL,
    },

    // Mission phase
    PHASE: {
        PLANNING: "PLANNING",
        IMPLEMENTATION: "IMPLEMENTATION",
        E2E: "E2E",
        FIXING: "FIXING",
        VERIFYING: "VERIFYING",
    },

    // Issue severity  
    SEVERITY: {
        HIGH: "HIGH",
        MEDIUM: "MEDIUM",
        LOW: "LOW",
    },

    // Research/documentation confidence level
    CONFIDENCE: {
        HIGH: "HIGH",      // Official documentation
        MEDIUM: "MEDIUM",  // GitHub, verified sources
        LOW: "LOW",        // Blog posts, unverified
    },

    // Session state
    SESSION: {
        STARTED: STATUS_LABEL.PENDING, // Standardized mapping
        COMPLETED: STATUS_LABEL.DONE,
        CANCELLED: STATUS_LABEL.CANCELLED,
    },

    // Task triage - complexity classification
    TRIAGE: {
        TYPE: {
            SIMPLE: "Simple",
            MEDIUM: "Medium",
            COMPLEX: "Complex",
        },
        SIGNAL: {
            ONE_FILE: "One file",
            MULTI_FILE: "Multi-file",
            LARGE_SCOPE: "Large scope",
        },
        APPROACH: {
            DIRECT: "Direct action",
            PLAN_EXECUTE_VERIFY: "Plan - Execute - Verify",
            RESEARCH_PLAN_PARALLEL: "Research - Plan - Parallel Execute",
        },
    },

    // TODO.md status values (for Epic/Task display)
    TODO_STATUS: {
        PENDING: STATUS_LABEL.PENDING,
        IN_PROGRESS: STATUS_LABEL.IN_PROGRESS,
        COMPLETE: STATUS_LABEL.COMPLETED,
        BLOCKED: STATUS_LABEL.BLOCKED,
        DONE: STATUS_LABEL.DONE,
        VERIFIED: STATUS_LABEL.VERIFIED,
    },


    // Task size estimation
    TASK_SIZE: {
        XS: "XS",   // <10min
        S: "S",     // 10-20min
        M: "M",     // 20-40min
        L: "L",     // 40-60min
    },
} as const;




/**
 * Prompt XML Tags
 * 
 * All XML tags used in agent prompts MUST be defined here.
 * Tags come in pairs: open and close.
 */

export const PROMPT_TAGS = {
    // === Common ===
    ROLE: { open: "<role>", close: "</role>" },
    IDENTITY: { open: "<identity>", close: "</identity>" },
    ROLE_MATRIX: { open: "<role_matrix>", close: "</role_matrix>" },
    MODULARITY: { open: "<modularity_rules>", close: "</modularity_rules>" },
    HPFA: { open: "<hyper_parallel>", close: "</hyper_parallel>" },
    FORBIDDEN_ACTIONS: { open: "<forbidden_actions>", close: "</forbidden_actions>" },
    REQUIRED_ACTIONS: { open: "<required_actions>", close: "</required_actions>" },
    VERIFICATION: { open: "<verification>", close: "</verification>" },
    ENVIRONMENT_DISCOVERY: { open: "<environment_discovery>", close: "</environment_discovery>" },
    ANTI_HALLUCINATION: { open: "<anti_hallucination>", close: "</anti_hallucination>" },
    TODO_RULES: { open: "<todo_rules>", close: "</todo_rules>" },
    COMPLETE_SIGNAL: { open: "<complete_signal>", close: "</complete_signal>" },
    SHARED_WORKSPACE: { open: "<shared_workspace>", close: "</shared_workspace>" },
    CORE_PHILOSOPHY: { open: "<core_philosophy>", close: "</core_philosophy>" },
    SYSTEM: { open: "<system>", close: "</system>" },
    TASK: { open: "<task>", close: "</task>" },
    CONTEXT: { open: "<context>", close: "</context>" },
    EXECUTION: { open: "<execution>", close: "</execution>" },
    MODE: { open: "<mode>", close: "</mode>" },
    RESUME: { open: "<resume>", close: "</resume>" },
    SAFETY: { open: "<safety>", close: "</safety>" },
    AST_TOOLS: { open: "<ast_tools>", close: "</ast_tools>" },
    LSP_TOOLS: { open: "<lsp_tools>", close: "</lsp_tools>" },
    SKILLS_CAPABILITIES: { open: "<skills_capabilities>", close: "</skills_capabilities>" },
    DECOMPOSITION_RULES: { open: "<decomposition_rules>", close: "</decomposition_rules>" },
    EXECUTION_ASSURANCE: { open: "<execution_assurance>", close: "</execution_assurance>" },

    // === Commander ===
    TOOLS: { open: "<tools>", close: "</tools>" },
    AGENTS: { open: "<agents>", close: "</agents>" },
    EXECUTION_RULES: { open: "<execution_rules>", close: "</execution_rules>" },
    EXECUTION_STRATEGY: { open: "<execution_strategy>", close: "</execution_strategy>" },
    PARALLEL_EXECUTION: { open: "<parallel_execution>", close: "</parallel_execution>" },
    TODO_FORMAT: { open: "<todo_format>", close: "</todo_format>" },
    SYNC_ISSUE_HANDLING: { open: "<sync_issue_handling>", close: "</sync_issue_handling>" },
    LOOP_CONTINUATION: { open: "<loop_continuation>", close: "</loop_continuation>" },
    RECOVERY: { open: "<recovery>", close: "</recovery>" },

    // === Planner ===
    FILE_LEVEL_PLANNING: { open: "<file_level_planning>", close: "</file_level_planning>" },
    TODO_SYNC: { open: "<todo_sync>", close: "</todo_sync>" },
    PLANNING_FORMAT: { open: "<planning_format>", close: "</planning_format>" },
    RESEARCH_WORKFLOW: { open: "<research_workflow>", close: "</research_workflow>" },

    // === Worker ===
    FILE_ASSIGNMENT: { open: "<file_assignment>", close: "</file_assignment>" },
    TDD_WORKFLOW: { open: "<tdd_workflow>", close: "</tdd_workflow>" },
    ISOLATION_TESTING: { open: "<isolation_testing>", close: "</isolation_testing>" },
    WORKFLOW: { open: "<workflow>", close: "</workflow>" },
    QUALITY_CHECKLIST: { open: "<quality_checklist>", close: "</quality_checklist>" },

    // === Reviewer ===
    SYNC_VERIFICATION: { open: "<sync_verification>", close: "</sync_verification>" },
    ASYNC_MONITORING: { open: "<async_monitoring>", close: "</async_monitoring>" },
    INTEGRATION_TESTING: { open: "<integration_testing>", close: "</integration_testing>" },
    VERIFICATION_PROCESS: { open: "<verification_process>", close: "</verification_process>" },
    TODO_MANAGEMENT: { open: "<todo_management>", close: "</todo_management>" },
    OUTPUT_FORMAT: { open: "<output_format>", close: "</output_format>" },
    // === Mission Loop ===
    MISSION_LOOP: { open: "<mission_loop>", close: "</mission_loop>" },
    TODO_CONTINUATION: { open: "<todo_continuation>", close: "</todo_continuation>" },
    AUTONOMOUS_MODE: { open: "<autonomous_mode>", close: "</autonomous_mode>" },
} as const;

/**
 * Helper to wrap content in tags
 */
export const wrapTag = (tag: { open: string; close: string }, content: string): string => {
    return `${tag.open}\n${content}\n${tag.close}`;
};

