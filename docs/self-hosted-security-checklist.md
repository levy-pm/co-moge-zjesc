# Self-Hosted Security Checklist

## Edge / Proxy
- [ ] Nginx/Caddy reverse proxy in front of Node
- [ ] TLS certificate auto-renew configured
- [ ] HTTP to HTTPS redirect enabled
- [ ] HSTS enabled after HTTPS validation
- [ ] request body size limit set (8MB aligned with app)
- [ ] edge-level rate limiting enabled

## Host
- [ ] dedicated non-root service user
- [ ] firewall restricts inbound ports
- [ ] fail2ban rules active for admin abuse
- [ ] unattended security updates enabled
- [ ] no password SSH login, only keys
- [ ] SSH root login disabled

## Runtime
- [ ] systemd service with restart policy
- [ ] Node process memory/cpu guardrails
- [ ] log rotation configured for app + nginx + deploy logs
- [ ] backup + restore drill tested

## Secrets
- [ ] API keys not stored in git
- [ ] `.env` owner and permissions restricted
- [ ] secret rotation schedule documented
- [ ] alert webhook token managed as secret

## Monitoring
- [ ] alerts on readiness failure
- [ ] alerts on 5xx/429 spikes
- [ ] alerts on AI upstream failure spikes
- [ ] alerts on blocked prompt/suspicious upload spikes
- [ ] host-level disk/memory/cpu alerts
