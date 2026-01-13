# Publishing Guide

> Release workflow for OpenCode Orchestrator

---

## Quick Release

```bash
# Patch: 0.1.8 → 0.1.9 (bug fixes)
bun run release:patch

# Minor: 0.1.8 → 0.2.0 (new features)
bun run release:minor

# Major: 0.1.8 → 1.0.0 (breaking changes)
bun run release:major
```

One command does everything:
1. Build Rust binary
2. Build TypeScript
3. Run tests
4. Version bump
5. Publish to npm
6. Git commit, tag, push

---

## Prerequisites

```bash
npm login          # npm account
docker --version   # Docker for Rust builds
bun --version      # Bun for TypeScript
```

---

## Scripts Reference

### Build

| Script | Description |
|--------|-------------|
| `build` | TypeScript + postinstall (fast) |
| `build:full` | Rust + TypeScript (complete) |
| `build:rust` | Rust binary only |
| `build:ts` | TypeScript only |

### Release

| Script | Description |
|--------|-------------|
| `release:patch` | Full release with patch bump |
| `release:minor` | Full release with minor bump |
| `release:major` | Full release with major bump |

### Other

| Script | Description |
|--------|-------------|
| `test` | Run tests in Docker |
| `test:local` | Run tests locally |
| `publish:npm` | Publish to npm only |

---

## Manual Release

```bash
# 1. Build
bun run build:full

# 2. Test
bun run test

# 3. Version
bun run version:patch

# 4. Publish
bun run publish:npm

# 5. Git
bun run release:git
```

---

## Published Package Contents

```
opencode-orchestrator/
├── dist/
│   ├── index.js              # Plugin code
│   ├── index.d.ts            # TypeScript types
│   └── scripts/postinstall.js # Auto-register
├── bin/orchestrator          # Rust binary
├── README.md
└── LICENSE
```

---

## Troubleshooting

**npm login issues:**
```bash
npm login --registry=https://registry.npmjs.org/
```

**2FA required:**
```bash
npm publish --access public --otp=123456
```

**Docker build fails:**
```bash
docker compose build --no-cache dev
```
