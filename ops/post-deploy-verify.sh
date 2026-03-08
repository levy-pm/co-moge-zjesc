#!/usr/bin/env bash
set -euo pipefail

HEALTH_URL="${1:-http://127.0.0.1:3000/backend/health}"
READINESS_URL="${2:-http://127.0.0.1:3000/backend/readiness}"
MAX_RETRIES="${MAX_RETRIES:-20}"
SLEEP_SECONDS="${SLEEP_SECONDS:-3}"

attempt=1
while [[ "$attempt" -le "$MAX_RETRIES" ]]; do
  if curl -fsS "$HEALTH_URL" >/dev/null && curl -fsS "$READINESS_URL" >/dev/null; then
    echo "[verify] health/readiness OK"
    exit 0
  fi
  echo "[verify] attempt $attempt/$MAX_RETRIES failed; waiting ${SLEEP_SECONDS}s"
  sleep "$SLEEP_SECONDS"
  attempt=$((attempt + 1))
done

echo "[verify] health/readiness check failed"
exit 1
