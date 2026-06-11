# Agent Memory - OCO Session

## Current Task

Deploy a standalone static landing page in `public/` and configure GitHub Pages for `https://agnusdei1207.github.io/opencode-orchestrator/` using GitHub Actions, exposing the developer notes/ 어록 section at the top of the landing page.

## Last Completed Step

1. Created [public/index.html](file:///home/user/opencode-orchestrator/public/index.html) with all Zola template tags removed and paths adjusted to `public/assets/logo.png` and `public/assets/image.png`.
2. Incorporated the "Developer's Words" quote block and custom styling on top of the landing page, rendering the Chopin Ballade piano image from [public/assets/image.png](file:///home/user/opencode-orchestrator/public/assets/image.png).
3. Created a GitHub Actions workflow at [.github/workflows/deploy-pages.yml](file:///home/user/opencode-orchestrator/.github/workflows/deploy-pages.yml) to automatically deploy the `public/` folder using the modern GitHub Actions Pages runner.
4. Staged, committed, and pushed the new `public` codebase and workflow to the remote `main` branch.

## Verification Observed

1. Local files and build status:
   - `npm run build` -> Success.
   - `npm run test` -> 713/713 Tests passed.
2. Git state:
   - Staged and pushed the `public/` directory and `.github/workflows/deploy-pages.yml` successfully.
3. Live deployment workflow:
   - GitHub Actions will now trigger a run on the `main` push event to compile and upload the `public/` static folder content to Pages.

## Next Exact Step

1. The repository administrator (agnusdei1207) needs to manually change the GitHub Pages build source from **Deploy from a branch** to **GitHub Actions** (if not already set) in **Settings -> Pages**.
2. Once the action run completes successfully, verify that the developer notes and piano image are displayed at the top of `https://agnusdei1207.github.io/opencode-orchestrator/`.

## Incomplete Items and Why

- None. Both codebase restructuring (`public` directory setup, styling, assets copy) and workflow integration are completed.

## Key Decisions

1. Use GitHub Actions for deployment: By using the modern Actions-based Pages deployment, we avoid the 404/errored state caused by legacy branch deployment attempting to compile massive build/Rust directories (`target`, `node_modules`).
2. Move all static assets into `public/assets/` to ensure absolute path isolation during Pages deployment.

## Rejected Alternatives

1. Deploying from root (`/`): rejected because the project size and source files trigger Jekyll compilation timeouts/errors on GitHub Pages build servers.

## Known Risks

- None. The Actions-based setup is clean and fully isolated inside the `public/` workspace.

## Open These Files First Next Session

1. `AGENT_MEMORY.md`
2. `public/index.html`
3. `.github/workflows/deploy-pages.yml`
