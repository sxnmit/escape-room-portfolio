#!/usr/bin/env bash
# Run every headless scenario against a dev server and summarise.
#   npx vite --port 5173 &
#   bash scripts/qa/run-all.sh http://127.0.0.1:5173 shots
set -u
URL="${1:-http://127.0.0.1:5173}"
OUT="${2:-shots}"
cd "$(dirname "$0")/../.."
FAILED=()
for s in e2e-flow:../e2e-flow.cjs terminal pipeline blocks keypad lanterns ui reset-flow edge-cases full-playthrough; do
  name="${s%%:*}"
  script="scripts/qa/${name}.cjs"
  [ -f "$script" ] || script="scripts/${name}.cjs"
  printf '\n===== %s =====\n' "$name"
  if node "$script" "$URL" "$OUT/$name" 2>&1 | tail -n 4; then :; fi
  if [ "${PIPESTATUS[0]}" -ne 0 ]; then FAILED+=("$name"); fi
done
printf '\n=========================\n'
if [ ${#FAILED[@]} -eq 0 ]; then echo "ALL SCENARIOS PASSED"; else echo "FAILED: ${FAILED[*]}"; fi
