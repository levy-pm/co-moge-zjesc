# Incident Response Notes (Self-Hosted)

## Severity Levels
- `SEV-1`: full outage, data exposure, security compromise
- `SEV-2`: major feature outage (chat/photo/admin unavailable)
- `SEV-3`: partial degradation, recoverable errors

## First 15 Minutes
1. Confirm incident scope:
   - `/backend/health`
   - `/backend/readiness`
   - frontend landing page load
2. Enable maintenance mode if user impact is severe.
3. Collect quick telemetry:
   - app logs (`security`, `ai`, `ops/alert`)
   - nginx access/error
   - systemd status
4. Decide rollback vs forward-fix.

## Security-Relevant Events To Watch
- repeated `429` spikes (`http_429`)
- blocked prompt spikes (`blocked_prompt`)
- suspicious upload spikes (`suspicious_upload`)
- AI upstream failures (`ai_upstream_failure`)
- readiness failures (`readiness_failure`)

## Immediate Containment
- temporarily tighten edge rate limits
- block abusive IPs (firewall/fail2ban)
- rotate API keys if leakage is suspected
- invalidate admin session secret if admin compromise suspected

## Recovery
- use rollback runbook when regression comes from latest deploy
- otherwise apply targeted hotfix and redeploy through cron flow
- verify with post-deploy checks before reopening traffic

## Postmortem Requirements
- timeline with UTC timestamps
- root cause and contributing factors
- detection gap analysis
- preventive actions with owners and deadlines
