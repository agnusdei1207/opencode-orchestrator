export declare const AGENT_NAMES: {
    readonly COMMANDER: "commander";
    readonly ARCHITECT: "architect";
    readonly BUILDER: "builder";
    readonly INSPECTOR: "inspector";
    readonly RECORDER: "recorder";
};
export type AgentName = (typeof AGENT_NAMES)[keyof typeof AGENT_NAMES];
