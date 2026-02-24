#!/usr/bin/env bash
set -euo pipefail

# GuardianAgent — Deployment pipeline
# Validates, builds, and previews npm package contents.
# Does NOT publish — shows what would be published and prints next steps.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== GuardianAgent Deploy Pipeline ==="
echo ""

# Step 1: Run tests
echo "[1/5] Running tests..."
npm test
echo ""

# Step 2: Clean and build
echo "[2/5] Building..."
rm -rf dist
npm run build
echo ""

# Step 3: Verify dist output
echo "[3/5] Verifying build output..."
if [ ! -f dist/index.js ]; then
  echo "ERROR: dist/index.js not found"
  exit 1
fi

# Check shebang
if head -1 dist/index.js | grep -q "#!/usr/bin/env node"; then
  echo "  Shebang: OK"
else
  echo "  WARNING: dist/index.js missing shebang (#!/usr/bin/env node)"
fi

JS_COUNT=$(find dist -name "*.js" | wc -l)
DTS_COUNT=$(find dist -name "*.d.ts" | wc -l)
echo "  JS files:  $JS_COUNT"
echo "  .d.ts files: $DTS_COUNT"
echo ""

# Step 4: Preview package contents
echo "[4/5] Package contents (npm pack --dry-run):"
npm pack --dry-run 2>&1
echo ""

# Step 5: Summary
PACKAGE_SIZE=$(npm pack --dry-run 2>&1 | tail -1)
echo "[5/5] Summary"
echo "  Package: $(node -p "require('./package.json').name")@$(node -p "require('./package.json').version")"
echo "  License: $(node -p "require('./package.json').license")"
echo "  $PACKAGE_SIZE"
echo ""
echo "=== Next Steps ==="
echo "  To publish to npm:   npm publish"
echo "  To publish dry-run:  npm publish --dry-run"
echo "  To push to GitHub:   git push -u origin main"
echo ""
