# Deployment Runbook (GitHub + SSH + Cron)

## Model
Current production model stays unchanged:
- repository on GitHub
- server has SSH access to repo
- cron triggers deploy pull

This runbook hardens that model instead of replacing it.

## Required Files
- `ops/cron-deploy.sh`
- `ops/post-deploy-verify.sh`
- `ops/verify-deploy-ready.mjs`

## Cron Entry Example
```bash
*/5 * * * * APP_DIR=/srv/co-moge-zjesc DEPLOY_BRANCH=main /srv/co-moge-zjesc/ops/cron-deploy.sh >> /var/log/co-moge-zjesc/cron-deploy.log 2>&1
```

## Deploy Flow
1. Cron starts `ops/cron-deploy.sh`.
2. Script acquires lock (`flock`) to prevent overlapping deploys.
3. Fetches remote branch and exits if no new commit.
4. Performs `git pull --ff-only` (no merge commits from server side).
5. Runs quality gates:
   - `npm run lint --prefix frontend`
   - `npm run test:server`
   - `npm run build:deploy`
   - `npm run verify:deploy-ready`
6. Restarts systemd service.
7. Runs post-deploy health/readiness verification.
8. Stores last successful commit in `.deploy-state/last-successful-commit`.

## Maintenance Mode
- Create maintenance flag file:
  - default path: `frontend/dist/tmp/maintenance.flag`
  - override: `MAINTENANCE_FLAG_FILE`
- While active, app returns `503` for user traffic (except health/readiness/admin metrics).
- Remove flag to return to normal mode.

## Post-Deploy Verification
- `GET /backend/health` should return `ok: true`
- `GET /backend/readiness` should return `ok: true`
- Optional: authenticated `GET /backend/admin/ops-metrics`

## Deploy Failure Handling
- If quality gates fail: deploy aborts before restart.
- If service restart fails: inspect `journalctl -u co-moge-zjesc -n 200`.
- If readiness fails after restart: execute rollback runbook.
