#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
start_only=false; build_only=false; skip_tests=false
for arg in "$@"; do
  case "$arg" in
    --start-only) start_only=true;;
    --build-only) build_only=true;;
    --skip-tests) skip_tests=true;;
    *) printf 'Unknown flag: %s\n' "$arg"; exit 1;;
  esac
done
if ! "$start_only"; then
  if ! "$skip_tests"; then npm run test:security-workspace; fi
  npm run check
  npm run build
fi
if "$build_only"; then exit 0; fi
test -f web/security/dist/index.html || { echo 'Run npm run build first'; exit 1; }
security_data_dir="${GUARDIAN_SECURITY_HOME:-$HOME/.guardianagent/security-v2}"
if ! test -f "$security_data_dir/admin-token.txt"; then node dist/security-main.js init --data-dir "$security_data_dir"; fi
exec node dist/security-main.js serve --data-dir "$security_data_dir"
