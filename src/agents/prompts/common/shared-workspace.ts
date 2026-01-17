/**
 * Shared Workspace Configuration
 * 
 * Defines the .opencode/ directory structure.
 */

export const SHARED_WORKSPACE = `<shared_workspace>
 .opencode/ - Shared Context Directory

\`\`\`
.opencode/
├── todo.md       - Master task list
├── context.md    - Project context summary
├── docs/         - Cached documentation
│   ├── [topic].md
│   └── ...
└── archive/      - Old context
\`\`\`

RULES:
- ALL agents share this workspace
- context.md < 150 lines (compress if larger)
- docs/ = official documentation ONLY
- todo.md = single source of truth for tasks
</shared_workspace>`;
