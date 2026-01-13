# Publishing Guide

> How to release new versions of OpenCode Orchestrator

---

## Quick Release (One Command)

```bash
# Patch release (0.1.3 → 0.1.4) - Bug fixes
bun run release:patch

# Minor release (0.1.3 → 0.2.0) - New features
bun run release:minor

# Major release (0.1.3 → 1.0.0) - Breaking changes
bun run release:major
```

This single command does everything:
1. ✅ Build Rust binary
2. ✅ Build TypeScript
3. ✅ Build install scripts
4. ✅ Run tests
5. ✅ Bump version
6. ✅ Publish to npm
7. ✅ Commit, tag, push to GitHub

---

## Prerequisites

```bash
# 1. npm login
npm login

# 2. Docker (for Rust builds)
docker --version

# 3. Bun
bun --version
```

---

## Available Scripts

### Build Scripts

| Script | Description |
|--------|-------------|
| `bun run build:rust` | Build Rust binary in Docker |
| `bun run build:rust:copy` | Copy binary from Docker to `/bin` |
| `bun run build:ts` | Build TypeScript to `/dist` |
| `bun run build:scripts` | Build postinstall script |
| `bun run build` | Build TS + scripts (fast) |
| `bun run build:full` | Build everything (Rust + TS + scripts) |

### Test Scripts

| Script | Description |
|--------|-------------|
| `bun run test` | Run tests in Docker |
| `bun run test:local` | Run tests locally (requires Rust) |

### Version Scripts

| Script | Description |
|--------|-------------|
| `bun run version:patch` | Bump patch version (0.1.3 → 0.1.4) |
| `bun run version:minor` | Bump minor version (0.1.3 → 0.2.0) |
| `bun run version:major` | Bump major version (0.1.3 → 1.0.0) |

### Publish Scripts

| Script | Description |
|--------|-------------|
| `bun run publish:npm` | Publish to npm registry |
| `bun run release:git` | Commit, tag, push to GitHub |

### Full Release Scripts

| Script | Description |
|--------|-------------|
| `bun run release:patch` | Full workflow: build → test → version → publish → git |
| `bun run release:minor` | Same with minor version bump |
| `bun run release:major` | Same with major version bump |

---

## Manual Release Steps

If you need more control:

### 1. Build

```bash
# Full build (Rust + TypeScript)
bun run build:full
```

### 2. Test

```bash
bun run test
```

### 3. Version Bump

```bash
bun run version:patch  # or minor/major
```

### 4. Publish

```bash
bun run publish:npm
```

### 5. Git

```bash
bun run release:git
```

---

## What Gets Published

```
opencode-orchestrator/
├── dist/
│   ├── index.js          # Main plugin
│   ├── index.d.ts         # TypeScript types
│   └── scripts/
│       └── postinstall.js # Auto-register script
├── bin/
│   └── orchestrator       # Rust binary
├── src/
│   └── index.ts           # Source code
├── scripts/
│   └── postinstall.ts     # Source
├── README.md
└── LICENSE
```

---

## Post-Install Behavior

When users install:

```bash
npm install opencode-orchestrator
```

The `postinstall` script runs automatically:

```
🦀 OpenCode Orchestrator - Installing...
✅ Plugin registered!
   Config: ~/.config/opencode/opencode.json

🚀 Ready! Restart OpenCode to use.
```

---

## Troubleshooting

### Permission denied on binary

```bash
chmod +x bin/orchestrator
```

### npm publish fails

```bash
# Check login
npm whoami

# Re-login
npm login
```

### Docker build fails

```bash
# Rebuild image
docker compose build --no-cache dev
```

### TypeScript errors

```bash
# Clean and rebuild
rm -rf dist node_modules
bun install
bun run build
```
