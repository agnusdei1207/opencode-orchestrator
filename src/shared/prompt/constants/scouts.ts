/**
 * Discovery Scouters - Phase 0 Specialized Roles
 */

export const SCOUTERS = {
    STRUCTURE: {
        ID: "STRUCTURE",
        NAME: "Scout: Structure",
        PROMPT: "Analyze the project folder structure. Locate source code (src, lib), tests, and documentation directories. Map out the tree at depth 2-3.",
    },
    STACK: {
        ID: "STACK",
        NAME: "Scout: Stack",
        PROMPT: "Identify the technology stack. Parse package.json, Cargo.toml, go.mod, or pyproject.toml. Determine build and test commands.",
    },
    DOCS: {
        ID: "DOCS",
        NAME: "Scout: Docs",
        PROMPT: "Digest the project documentation. Read README.md, CONTRIBUTING.md, and any files in docs/ to understand the core architecture and mission.",
    },
    INFRA: {
        ID: "INFRA",
        NAME: "Scout: Infra",
        PROMPT: "Detect infrastructure and environment configs. Search for Dockerfiles, CI/CD workflows (.github, .gitlab), and environment variable templates.",
    },
} as const;
