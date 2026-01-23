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
    FORBIDDEN_ACTIONS: { open: "<forbidden_actions>", close: "</forbidden_actions>" },
    REQUIRED_ACTIONS: { open: "<required_actions>", close: "</required_actions>" },
    VERIFICATION: { open: "<verification>", close: "</verification>" },
    ENVIRONMENT_DISCOVERY: { open: "<environment_discovery>", close: "</environment_discovery>" },
    ANTI_HALLUCINATION: { open: "<anti_hallucination>", close: "</anti_hallucination>" },
    TODO_RULES: { open: "<todo_rules>", close: "</todo_rules>" },
    MISSION_SEAL: { open: "<mission_seal>", close: "</mission_seal>" },
    SHARED_WORKSPACE: { open: "<shared_workspace>", close: "</shared_workspace>" },
    CORE_PHILOSOPHY: { open: "<core_philosophy>", close: "</core_philosophy>" },

    // === Commander ===
    TOOLS: { open: "<tools>", close: "</tools>" },
    AGENTS: { open: "<agents>", close: "</agents>" },
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

    // === Master Reviewer ===
    SEAL_AUTHORITY: { open: "<seal_authority>", close: "</seal_authority>" },
    FORBIDDEN: { open: "<forbidden>", close: "</forbidden>" },
    CAPABILITIES: { open: "<capabilities>", close: "</capabilities>" },
    VERIFICATION_COMPLETE: { open: "<verification_complete>", close: "</verification_complete>" },
    VERIFICATION_FAILED: { open: "<verification_failed>", close: "</verification_failed>" },

    // === Mission Loop ===
    MISSION_LOOP: { open: "<mission_loop>", close: "</mission_loop>" },
    AUTONOMOUS_MODE: { open: "<autonomous_mode>", close: "</autonomous_mode>" },
} as const;

/**
 * Helper to wrap content in tags
 */
export const wrapTag = (tag: { open: string; close: string }, content: string): string => {
    return `${tag.open}\n${content}\n${tag.close}`;
};
