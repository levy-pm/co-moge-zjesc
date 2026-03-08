# Deployment Checklist (Self-Hosted)

## Pre-Deploy
- [ ] `npm ci` (root)
- [ ] `npm ci --prefix frontend`
- [ ] `npm run lint --prefix frontend`
- [ ] `npm run test:server`
- [ ] `npm run build:deploy --prefix frontend`
- [ ] `npm run verify:deploy-ready`
- [ ] Verify `.env` values for production (no empty secrets)

## Environment
- [ ] `ANON_SESSION_SECRET` is set and at least 32 chars
- [ ] `ADMIN_SESSION_SECRET` is set and at least 32 chars
- [ ] `ADMIN_PASSWORD` is set for admin panel
- [ ] `COOKIE_SECURE=true`
- [ ] `TRUST_PROXY=true` (only when reverse proxy is configured correctly)

## Network / Edge
- [ ] Reverse proxy in front of Node app
- [ ] HTTPS certificate active and auto-renew configured
- [ ] HTTP -> HTTPS redirect enabled
- [ ] HSTS configured at edge
- [ ] Firewall rules restricted to required ports only

See: `docs/edge-proxy-tls-hardening.md` and `ops/nginx/co-moge-zjesc.conf.example`.

## Runtime Safety
- [ ] System service auto-restart enabled (`systemd`, `pm2`, etc.)
- [ ] `ops/cron-deploy.sh` configured in cron with lock and logs
- [ ] `ops/post-deploy-verify.sh` configured and executable
- [ ] Log rotation configured
- [ ] Process limits configured (memory/cpu watchdog)
- [ ] Backups configured and restore test performed

## Post-Deploy Verification
- [ ] `GET /backend/health` returns `ok: true`
- [ ] `GET /backend/readiness` returns `ok: true`
- [ ] Session cookie is `HttpOnly` and `Secure` (prod HTTPS)
- [ ] Chat quota enforced after configured limit
- [ ] Photo quota enforced after configured limit
- [ ] 429 responses include `Retry-After`

## Current Deployment Risk Note
Cron-based `git pull` auto-update without quality gates is not target-state for production.
Recommended path:
1. CI checks on pull request
2. Build artifact creation
3. Controlled deploy (staging -> production)
4. Health-check gated rollout

Current repository now includes hardened cron deploy helpers and rollback runbooks.
