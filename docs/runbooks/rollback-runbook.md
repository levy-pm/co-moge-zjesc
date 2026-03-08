# Rollback Runbook

## Trigger Conditions
- repeated `503` from `/backend/readiness`
- sustained `5xx` spike after deploy
- broken chat/photo/admin critical path

## Prerequisites
- server has repo checkout in `APP_DIR`
- last successful deploy commit exists in `.deploy-state/last-successful-commit`
- systemd service name is known (`co-moge-zjesc` by default)

## Rollback Command
```bash
APP_DIR=/srv/co-moge-zjesc DEPLOY_BRANCH=main /srv/co-moge-zjesc/ops/rollback.sh
```

Optional explicit commit:
```bash
APP_DIR=/srv/co-moge-zjesc DEPLOY_BRANCH=main /srv/co-moge-zjesc/ops/rollback.sh <commit_sha>
```

## What Rollback Script Does
1. Fetches git refs.
2. Resets current branch hard to target commit.
3. Runs quality gates (`lint`, `test:server`, `build:deploy`, `verify:deploy-ready`).
4. Restarts service.
5. Verifies health/readiness.

## Manual Validation After Rollback
- open landing page in browser
- send one chat request
- verify quota error path (quick 429 check)
- verify `/backend/admin/me` response shape

## If Rollback Fails
- Block traffic with maintenance mode flag.
- Restart previous known-good artifact or snapshot.
- Open incident and attach logs:
  - app logs
  - nginx logs
  - deploy logs
