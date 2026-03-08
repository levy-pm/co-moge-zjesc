# Edge Proxy / TLS Hardening (Self-Hosted)

## Objective
Harden the mandatory edge layer in front of Node runtime.

## Reference Artifacts
- `ops/nginx/co-moge-zjesc.conf.example`
- `ops/fail2ban/co-moge-zjesc-nginx-http-auth.conf.example`
- `ops/systemd/co-moge-zjesc.service.example`

## Required Edge Controls
1. TLS termination at proxy.
2. HTTP to HTTPS redirect.
3. HSTS after HTTPS validation.
4. Real client IP forwarding:
   - `X-Real-IP`
   - `X-Forwarded-For`
   - `X-Forwarded-Proto`
5. Header hardening on edge.
6. `client_max_body_size` aligned with app limits.
7. Edge rate-limiting for coarse abuse filtering.

## App Alignment
- set `TRUST_PROXY=true` only behind trusted proxy
- set `COOKIE_SECURE=true` in HTTPS production
- set cookie SameSite based on product requirements (`Lax` default)

## Host Controls Outside Repo
- firewall rules
- fail2ban jails
- log rotation
- backup and restore
- OS patch management
- SSH hardening

## Validation
- verify `Strict-Transport-Security` header on HTTPS responses
- verify secure cookie flags in browser dev tools
- verify real IP is visible in backend logs (hashed in app logs)
