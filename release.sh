#!/bin/bash
# OpenCode Orchestrator - Release Script
# Wrapper for npm scripts

set -e

VERSION_TYPE=${1:-patch}

echo "🦀 OpenCode Orchestrator - Release ($VERSION_TYPE)"
echo "==================================="
echo

case $VERSION_TYPE in
    patch)
        bun run release:patch
        ;;
    minor)
        bun run release:minor
        ;;
    major)
        bun run release:major
        ;;
    *)
        echo "Usage: ./release.sh [patch|minor|major]"
        echo ""
        echo "Examples:"
        echo "  ./release.sh patch   # 0.1.3 → 0.1.4"
        echo "  ./release.sh minor   # 0.1.3 → 0.2.0"
        echo "  ./release.sh major   # 0.1.3 → 1.0.0"
        exit 1
        ;;
esac
