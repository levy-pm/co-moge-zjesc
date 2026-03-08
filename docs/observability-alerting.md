# Observability And Alerting Notes

## Log Categories
- `app`: normal runtime and access logs
- `security`: abuse-related and suspicious activity
- `ai`: model invocation and upstream errors
- `auth/session`: anonymous/admin session events
- `admin`: admin access/auth activity
- `ops/alert`: threshold-based operational alerts

## Operational Telemetry Events
The backend tracks rolling-window counters for:
- `http_5xx`
- `http_429`
- `blocked_prompt`
- `suspicious_upload`
- `readiness_failure`
- `ai_upstream_failure`

Thresholds are controlled via env:
- `OPS_ALERT_WINDOW_MS`
- `OPS_ALERT_COOLDOWN_MS`
- `OPS_ALERT_HTTP_5XX_THRESHOLD`
- `OPS_ALERT_HTTP_429_THRESHOLD`
- `OPS_ALERT_BLOCKED_PROMPT_THRESHOLD`
- `OPS_ALERT_SUSPICIOUS_UPLOAD_THRESHOLD`
- `OPS_ALERT_READINESS_FAILURE_THRESHOLD`
- `OPS_ALERT_AI_FAILURE_THRESHOLD`

Optional alert hook:
- `OPS_ALERT_WEBHOOK_URL`
- `OPS_ALERT_WEBHOOK_TIMEOUT_MS`

## Metrics Endpoint
- `GET /backend/admin/ops-metrics`
- requires admin authentication
- returns rolling counters snapshot for operations/debugging

## Recommended Alerts
- readiness failures >= threshold in 1 minute
- 5xx spikes >= threshold in 1 minute
- AI upstream failures >= threshold in 1 minute
- repeated 429 >= threshold in 1 minute
- blocked prompt spikes (abuse campaigns)
- suspicious upload spikes (malformed payload probing)

## Manual Monitoring Checklist
- check `journalctl -u co-moge-zjesc -f`
- check reverse proxy access/error logs
- confirm cron deploy logs and last successful commit
- confirm health/readiness before and after deploy
