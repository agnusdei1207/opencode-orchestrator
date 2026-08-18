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
const SRC_CSS = join(SRC_DIR, "css");
const SRC_JS = join(SRC_DIR, "js");
const SRC_FAVICON = join(SRC_DIR, "favicon.svg");

const DEST_HTML = join(ROOT, "index.html");
const DEST_ASSETS = join(ROOT, "assets");
const DEST_CSS = join(ROOT, "css");
const DEST_JS = join(ROOT, "js");
const DEST_FAVICON = join(ROOT, "favicon.svg");

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
    console.log("[sync-landing] mirrored public/assets/ → assets/");
}

if (existsSync(SRC_CSS)) {
    if (!existsSync(DEST_CSS)) mkdirSync(DEST_CSS, { recursive: true });
    cpSync(SRC_CSS, DEST_CSS, { recursive: true });
    console.log("[sync-landing] mirrored public/css/ → css/");
}

if (existsSync(SRC_JS)) {
    if (!existsSync(DEST_JS)) mkdirSync(DEST_JS, { recursive: true });
    cpSync(SRC_JS, DEST_JS, { recursive: true });
    console.log("[sync-landing] mirrored public/js/ → js/");
}

if (existsSync(SRC_FAVICON) && !same(SRC_FAVICON, DEST_FAVICON)) {
    cpSync(SRC_FAVICON, DEST_FAVICON);
    console.log("[sync-landing] mirrored public/favicon.svg → favicon.svg");
}

console.log(
    changed > 0
        ? "[sync-landing] root landing page synced to canonical public/ source."
        : "[sync-landing] root landing page already in sync.",
);
