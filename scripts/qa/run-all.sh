#!/usr/bin/env bash
# Run every headless scenario against a dev server and summarise.
#
#   npx vite --port 5173 &
#   bash scripts/qa/run-all.sh http://127.0.0.1:5173 shots
#
# Exits non-zero if any scenario fails.
set -u
URL="${1:-http://127.0.0.1:5173}"
OUT="${2:-shots}"
cd "$(dirname "$0")/../.."

SCENARIOS=(e2e-flow terminal pipeline blocks keypad lanterns ui reset-flow edge-cases full-playthrough)
FAILED=()
for name in "${SCENARIOS[@]}"; do
  script="scripts/qa/${name}.cjs"
  [ -f "$script" ] || script="scripts/${name}.cjs"
  printf '\n===== %s =====\n' "$name"
  node "$script" "$URL" "$OUT/$name" 2>&1 | grep -E "^(PASS|FAIL|CONSOLE ERRORS|[0-9]+/[0-9]+ checks|failed:)" | tail -n 3
  [ "${PIPESTATUS[0]}" -eq 0 ] || FAILED+=("$name")
done

printf '\n=========================\n'
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "ALL SCENARIOS PASSED"
else
  echo "FAILED: ${FAILED[*]}"
  exit 1
fi
