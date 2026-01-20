/**
 * Discovery Scouters - Phase 0 Specialized Roles
 */

/**
 * Basic identifier for discovery agents
 */
export const SCOUT_LABEL = "Scout";

export const SCOUT_STRUCTURE = {
    ID: "STRUCTURE",
    NAME: `${SCOUT_LABEL}: Structure`,
    PROMPT: "Analyze the project folder structure. Locate source code (src, lib), tests, and documentation directories. Map out the tree at depth 2-3.",
} as const;

export const SCOUT_STACK = {
    ID: "STACK",
    NAME: `${SCOUT_LABEL}: Stack`,
    PROMPT: "Identify the technology stack. Parse package.json, Cargo.toml, go.mod, or pyproject.toml. Determine build and test commands.",
} as const;

export const SCOUT_DOCS = {
    ID: "DOCS",
    NAME: `${SCOUT_LABEL}: Docs`,
    PROMPT: "Digest the project documentation. Read README.md, CONTRIBUTING.md, and any files in docs/ to understand the core architecture and mission.",
} as const;

export const SCOUT_INFRA = {
    ID: "INFRA",
    NAME: `${SCOUT_LABEL}: Infra`,
    PROMPT: "Detect infrastructure and environment configs. Search for Dockerfiles, CI/CD workflows (.github, .gitlab), and environment variable templates.",
} as const;
