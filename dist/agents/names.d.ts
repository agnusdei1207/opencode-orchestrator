export declare const AGENT_NAMES: {
    readonly ORCHESTRATOR: "orchestrator";
    readonly PLANNER: "planner";
    readonly CODER: "coder";
    readonly REVIEWER: "reviewer";
    readonly SEARCHER: "searcher";
    readonly SURGEON: "surgeon";
    readonly EXECUTOR: "executor";
    readonly VISUALIST: "visualist";
    readonly PUBLISHER: "publisher";
};
export type AgentName = typeof AGENT_NAMES[keyof typeof AGENT_NAMES];
