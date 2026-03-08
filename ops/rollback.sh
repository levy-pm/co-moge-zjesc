#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/co-moge-zjesc}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-co-moge-zjesc}"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-$APP_DIR/.deploy-state}"

cd "$APP_DIR"
git fetch --all --prune

TARGET_COMMIT="${1:-}"
if [[ -z "$TARGET_COMMIT" ]]; then
  if [[ -f "$DEPLOY_STATE_DIR/last-successful-commit" ]]; then
    TARGET_COMMIT="$(cat "$DEPLOY_STATE_DIR/last-successful-commit")"
  else
    echo "[rollback] missing target commit and no last-successful-commit state"
    exit 1
  fi
fi

echo "[rollback] target commit: $TARGET_COMMIT"
git checkout "$DEPLOY_BRANCH"
git reset --hard "$TARGET_COMMIT"

npm run lint --prefix frontend
npm run test:server
npm run build:deploy
npm run verify:deploy-ready

sudo systemctl restart "$SERVICE_NAME"
sudo systemctl is-active --quiet "$SERVICE_NAME"

"$APP_DIR/ops/post-deploy-verify.sh"
echo "[rollback] completed"
