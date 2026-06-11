# Agent Memory - OCO Session

## Current Task

Deploy a standalone static landing page in `docs/` and configure GitHub Pages for `https://agnusdei1207.github.io/opencode-orchestrator/` as the primary project homepage, replacing references to old external sites and syncing npm configuration.

## Last Completed Step

1. Located Zola templates and static logo inside `/home/user/brainscience`.
2. Verified that `docs/index.html` (the standalone landing page with Zola template syntax removed) and its corresponding logo asset `docs/assets/img/opencode-logo.png` exist.
3. Edited [README.md](file:///home/user/opencode-orchestrator/README.md) to add a direct link to the new GitHub Pages website.
4. Confirmed `package.json` has `"homepage": "https://agnusdei1207.github.io/opencode-orchestrator/"` and verified tests pass.
5. Staged and pushed all changes, including `docs/index.html` and `docs/assets/img/opencode-logo.png`, to remote `main`.
6. Discovered that configuring Pages at the repository root (`/`) causes compile errors (`errored`) due to large build directories (`crates`, `node_modules`, `target`).
7. Cleaned up root static files (`index.html`, `.nojekyll`) and pushed changes to enforce serving solely from the `/docs` subdirectory.

## Verification Observed

1. Local files and build status:
   - `npm run build` -> Success.
   - `npm run test` -> 713/713 Tests passed.
2. Git state:
   - Cleaned up root files, pushed successfully.
3. GitHub Token permissions:
   - `gh repo view agnusdei1207/opencode-orchestrator --json viewerPermission` -> Returned `WRITE`.
   - Admin settings changes and Pages provisioning APIs block with HTTP `404`.

## Next Exact Step

1. The repository administrator (agnusdei1207) must manually update the GitHub Pages settings via the web interface:
   - Go to **Settings -> Pages**.
   - Under **Build and deployment -> Branch**, select `main` and change the folder from `/` (root) to `/docs`.
   - Save the settings.
2. Once the build succeeds, update the repository sidebar Homepage URL to `https://agnusdei1207.github.io/opencode-orchestrator/` on GitHub.

## Incomplete Items and Why

- Changing the Pages source folder from `/` to `/docs` and setting the repository sidebar homepage must be performed by the repository administrator due to token permission constraints (current PAT has `WRITE` access, not `ADMIN`).

## Key Decisions

1. Rely on the `/docs` directory for GitHub Pages instead of the root `/` directory to prevent GitHub's build system from indexing project sources (`crates`, `node_modules`, `target`), which results in build timeouts/errors.
2. Strip Zola dependencies (like `{{ get_url(...) }}`) completely from the file so it is entirely self-contained, allowing direct browser viewing and static serving.

## Rejected Alternatives

1. Keeping static files at both root and `/docs`: rejected because it duplicates assets and root Pages configuration triggers full project compilation errors.

## Known Risks

1. The site will continue returning a build error/404 until the Pages source path is switched to `/docs` in GitHub repository settings.

## Open These Files First Next Session

1. `AGENT_MEMORY.md`
2. `docs/index.html`
3. `package.json`
4. `README.md`
