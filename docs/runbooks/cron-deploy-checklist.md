# Cron Deploy Checklist (GitHub + SSH)

## Before Enabling Cron
- [ ] Deploy key has read-only GitHub access.
- [ ] `ops/cron-deploy.sh` is executable.
- [ ] `ops/post-deploy-verify.sh` is executable.
- [ ] service account can restart systemd unit.
- [ ] `.env` is present and permission-restricted (`chmod 600`).
- [ ] `TRUST_PROXY=true` only if reverse proxy is configured.
- [ ] `COOKIE_SECURE=true` in production HTTPS.

## Each Release Window
- [ ] Confirm CI quality gates are green.
- [ ] Confirm branch policy (`main` or configured branch).
- [ ] Confirm rollback target commit is known.
- [ ] Confirm maintenance toggle path exists.

## After Cron Deployment
- [ ] check deploy log for `success at commit`.
- [ ] check `systemctl status co-moge-zjesc`.
- [ ] check `/backend/health`.
- [ ] check `/backend/readiness`.
- [ ] check app landing page and chat smoke flow.
