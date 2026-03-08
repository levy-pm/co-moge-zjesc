#!/usr/bin/env bash
set -euo pipefail

# Hardened wrapper for existing cron-based deploy model.
# This script keeps GitHub + SSH + cron flow, but adds quality gates and verification.

APP_DIR="${APP_DIR:-/srv/co-moge-zjesc}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-co-moge-zjesc}"
LOCK_FILE="${LOCK_FILE:-/var/lock/co-moge-zjesc-deploy.lock}"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-$APP_DIR/.deploy-state}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/backend/health}"
READINESS_URL="${READINESS_URL:-http://127.0.0.1:3000/backend/readiness}"

mkdir -p "$DEPLOY_STATE_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[deploy] another deployment is still running; skipping"
  exit 0
fi

cd "$APP_DIR"

echo "[deploy] fetching branch $DEPLOY_BRANCH"
git fetch origin "$DEPLOY_BRANCH"

CURRENT_COMMIT="$(git rev-parse HEAD)"
REMOTE_COMMIT="$(git rev-parse "origin/$DEPLOY_BRANCH")"

if [[ "$CURRENT_COMMIT" == "$REMOTE_COMMIT" ]]; then
  echo "[deploy] no new commit; skipping"
  exit 0
fi

echo "$CURRENT_COMMIT" > "$DEPLOY_STATE_DIR/previous-commit"
echo "[deploy] upgrading $CURRENT_COMMIT -> $REMOTE_COMMIT"

git checkout "$DEPLOY_BRANCH"
git pull --ff-only origin "$DEPLOY_BRANCH"

NEW_COMMIT="$(git rev-parse HEAD)"
CHANGED_FILES="$(git diff --name-only "$CURRENT_COMMIT" "$NEW_COMMIT")"

if grep -q "^package-lock.json$" <<<"$CHANGED_FILES"; then
  echo "[deploy] root dependencies changed"
  npm ci --omit=dev
fi

if grep -q "^frontend/package-lock.json$" <<<"$CHANGED_FILES"; then
  echo "[deploy] frontend dependencies changed"
  npm ci --prefix frontend
fi

echo "[deploy] running quality gates"
npm run lint --prefix frontend
npm run test:server
npm run build:deploy
npm run verify:deploy-ready

echo "[deploy] restarting service $SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl is-active --quiet "$SERVICE_NAME"

echo "[deploy] post-deploy verification"
"$APP_DIR/ops/post-deploy-verify.sh" "$HEALTH_URL" "$READINESS_URL"

echo "$NEW_COMMIT" > "$DEPLOY_STATE_DIR/last-successful-commit"
echo "[deploy] success at commit $NEW_COMMIT"
