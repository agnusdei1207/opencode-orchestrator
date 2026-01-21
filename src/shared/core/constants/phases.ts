/**
 * Mission Phase Constants
 */

export const PHASES = {
    PHASE_0: {
        ID: "PHASE_0",
        NAME: "DISCOVERY",
        DESCRIPTION: "Parallel intelligence gathering and project mapping",
        MANDATORY: true,
    },
    PHASE_1: {
        ID: "PHASE_1",
        NAME: "THINK",
        DESCRIPTION: "Analyze scope, decomposition, and delegation",
        MANDATORY: true,
    },
    PHASE_2: {
        ID: "PHASE_2",
        NAME: "TRIAGE",
        DESCRIPTION: "Complexity assessment and execution path selection",
        MANDATORY: true,
    },
    PHASE_3: {
        ID: "PHASE_3",
        NAME: "PLAN",
        DESCRIPTION: "Architectural roadmap and task grid creation",
        MANDATORY: true,
    },
    PHASE_4: {
        ID: "PHASE_4",
        NAME: "EXECUTE",
        DESCRIPTION: "HPFA grid execution and worker coordination",
        MANDATORY: true,
    },
    PHASE_5: {
        ID: "PHASE_5",
        NAME: "VERIFY",
        DESCRIPTION: "MSVP final gate and E2E system validation",
        MANDATORY: true,
    },
    PHASE_6: {
        ID: "PHASE_6",
        NAME: "SEAL",
        DESCRIPTION: "Mission completion and deterministic output",
        MANDATORY: true,
    },
} as const;
