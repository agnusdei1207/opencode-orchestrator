# Contributing to OpenCode Orchestrator

## Development Setup

```bash
# Build and link locally
npm run dev:link

# Restart OpenCode to test
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build the plugin |
| `npm run dev:link` | Build + link for local testing |
| `npm run dev:unlink` | Unlink from global |
| `npm run dev:status` | Check link status |

## Testing

```bash
# Run all tests (87 tests)
npm run test:all

# Run unit tests only
npm run test:unit

# Run E2E tests only
npm run test:e2e

# Watch mode
npm run test:watch
```

### Test Structure

```
tests/
├── unit/                        # Unit tests
│   ├── concurrency.test.ts
│   ├── task-store.test.ts
│   ├── parallel-manager.test.ts
│   └── integration.test.ts
└── e2e/                         # E2E tests
    ├── background-task.test.ts
    ├── session.test.ts
    ├── rust-integration.test.ts
    └── full-system.test.ts
```

## Release

```bash
npm run release:patch   # 0.5.5 → 0.5.6
npm run release:minor   # 0.5.6 → 0.6.0
npm run release:major   # 0.6.0 → 1.0.0
```

Each release:
1. Builds the plugin
2. Bumps version
3. Creates git tag
4. Pushes to remote
5. Publishes to npm
