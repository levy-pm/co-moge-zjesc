# Security And Deployment Hardening

## Scope
This project runs React + Node.js runtime in one process and exposes AI-enabled endpoints (`/backend/chat/options`, `/backend/chat/photo`).

## Security Controls Implemented In Repo
- Signed anonymous session cookie (`HttpOnly`, `SameSite`, optional `Secure`)
- Server-side session store with adapter chain:
  - MySQL (preferred)
  - file store fallback
  - memory fallback (last resort)
- Session quotas:
  - chat quota per session
  - photo quota per session
  - feedback quota per session
- Per-IP + per-endpoint rate limiting
- Prompt policy layer:
  - `allow` / `suspicious` / `block`
  - suspicious requests degrade to local-only mode
  - blocked requests return safe fallback response
- Photo upload guards:
  - MIME allowlist
  - extension allowlist (if filename supplied)
  - base64 structure checks
  - max payload size checks
- Structured logs with request IDs and sensitive key redaction
- Operational telemetry counters for:
  - `http_5xx`
  - `http_429`
  - `blocked_prompt`
  - `suspicious_upload`
  - `readiness_failure`
  - `ai_upstream_failure`
- Optional alert webhook (`OPS_ALERT_WEBHOOK_URL`)
- `/backend/health` and `/backend/readiness` endpoints
- `/backend/admin/ops-metrics` endpoint (admin-auth protected)

## Required Infrastructure Controls (Outside Repo)
These controls are mandatory for production and cannot be fully enforced in app code:
- Reverse proxy (Nginx/Caddy/Traefik) in front of Node
- TLS termination with modern ciphers
- Enforce HTTPS redirects
- HSTS on edge (and only after HTTPS is stable)
- Host-level firewall (allow only required ports)
- Fail2ban or equivalent source-IP abuse control
- Log rotation + retention policy on host
- Secret manager or at minimum root-only `.env` permissions
- Backup and restore workflow for MySQL + runtime config
- Monitoring/alerting stack (CPU, memory, disk, 5xx rate, 429 anomalies)

## Cookie And Proxy Notes
- Set `TRUST_PROXY=true` only when app is behind a trusted reverse proxy.
- Set `COOKIE_SECURE=true` in production over HTTPS.
- Keep `COOKIE_SAME_SITE=Lax` unless strict cross-site requirements force `None` + `Secure`.

## AI Abuse And Cost Notes
- Keep quotas enabled and aligned with budget limits.
- Keep `AI_HTTP_TIMEOUT_MS` conservative to avoid hanging worker slots.
- Review suspicious/blocked telemetry regularly for prompt abuse trends.
- Consider adding provider-level budget caps and model-level allowlists.

## Runbooks
- `docs/runbooks/deployment-runbook.md`
- `docs/runbooks/rollback-runbook.md`
- `docs/runbooks/incident-response.md`
- `docs/runbooks/cron-deploy-checklist.md`
- `docs/observability-alerting.md`

## Session Store Notes
- MySQL-backed sessions are production default.
- File fallback is acceptable for single-node low-traffic deployments.
- Memory store is emergency fallback only (not restart-safe).
- Redis adapter remains a planned enhancement for horizontal scaling.
