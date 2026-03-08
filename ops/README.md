# Ops Scripts

## Purpose
Operational scaffolding for self-hosted production while preserving GitHub + SSH + cron deploy model.

## Scripts
- `cron-deploy.sh`: hardened cron deploy flow with lock, quality gates and post-check.
- `post-deploy-verify.sh`: health/readiness verification helper.
- `rollback.sh`: rollback to last-successful or explicit commit.
- `verify-deploy-ready.mjs`: repository/artifact consistency checks.

## Config Templates
- `nginx/co-moge-zjesc.conf.example`
- `fail2ban/co-moge-zjesc-nginx-http-auth.conf.example`
- `systemd/co-moge-zjesc.service.example`

## Notes
- These scripts assume Linux server environment.
- They are scaffolds and require local adaptation (`APP_DIR`, service name, privileges).
