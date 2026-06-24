#!/usr/bin/env node
/**
 * sync-landing.mjs — Mirror the canonical landing page into the repo root.
 *
 * Single source of truth: `public/` (the directory GitHub Pages publishes,
 * see .github/workflows/deploy-pages.yml → upload-pages-artifact path './public').
 *
 * The repo-root `index.html` + `assets/` exist only so the project page renders
 * when browsing the repository root. They are a *mirror*, never hand-edited.
 * Edit `public/index.html` (and `public/assets/`), then this script copies it
 * out. Runs automatically as the npm `prebuild` step, so the root copy can never
 * silently drift the way the old `docs/index.html` did.
 */

import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(ROOT, "public");
const SRC_HTML = join(SRC_DIR, "index.html");
const SRC_ASSETS = join(SRC_DIR, "assets");
const DEST_HTML = join(ROOT, "index.html");
const DEST_ASSETS = join(ROOT, "assets");

if (!existsSync(SRC_HTML)) {
    console.error(`[sync-landing] canonical source missing: ${SRC_HTML}`);
    process.exit(1);
}

function same(a, b) {
    return existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b));
}

let changed = 0;

if (!same(SRC_HTML, DEST_HTML)) {
    cpSync(SRC_HTML, DEST_HTML);
    changed++;
    console.log("[sync-landing] updated index.html from public/index.html");
}

if (existsSync(SRC_ASSETS)) {
    if (!existsSync(DEST_ASSETS)) mkdirSync(DEST_ASSETS, { recursive: true });
    cpSync(SRC_ASSETS, DEST_ASSETS, { recursive: true });
    // cpSync is a no-op-by-content only at the file level; report coarsely.
    console.log("[sync-landing] mirrored public/assets/ → assets/");
}

console.log(
    changed > 0
        ? "[sync-landing] root landing page synced to canonical public/ source."
        : "[sync-landing] root landing page already in sync.",
);
