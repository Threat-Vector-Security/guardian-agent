#!/usr/bin/env bash
set -euo pipefail

# GuardianAgent — Local dev build and test
# Builds, runs tests, and optionally installs globally for local testing.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== GuardianAgent Dev Build ==="
echo ""

# Step 1: Build
echo "[1/4] Building..."
rm -rf dist
npm run build
echo "  Build: OK"
echo ""

# Step 2: Run tests
echo "[2/4] Running tests..."
npm test
echo ""

# Step 3: Create local tarball
echo "[3/4] Packing local tarball..."
TARBALL=$(npm pack 2>&1 | tail -1)
echo "  Created: $TARBALL"
echo ""

# Step 4: Install instructions
echo "[4/4] Local testing options:"
echo ""
echo "  Option A — Install globally from tarball:"
echo "    npm install -g ./$TARBALL"
echo "    guardianagent"
echo ""
echo "  Option B — Run directly without installing:"
echo "    node dist/index.js"
echo ""
echo "  Option C — Run in dev mode (with tsx):"
echo "    npm run dev"
echo ""
echo "  Option D — Link for development (updates live):"
echo "    npm link"
echo "    guardianagent"
echo "    # When done: npm unlink -g guardianagent"
echo ""
