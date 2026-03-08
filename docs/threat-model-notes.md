# Threat Model Notes (Current Stage)

## Assets
- API keys (`GROQ_API_KEY`, `GEMINI_API_KEY`)
- Admin session integrity
- Anonymous session quota integrity
- Recipe data integrity
- Service availability and AI budget

## Primary Threats
- Prompt injection / jailbreak / data exfiltration attempts
- Abuse floods to AI endpoints (cost amplification)
- Quota bypass by client-side state reset
- Cookie tampering and forged session identifiers
- Malicious photo payloads (oversized or malformed)
- Admin brute-force attempts

## Implemented Mitigations
- Signed server-issued anonymous session cookie
- Server-side persistent session/quota state
- Per-IP + per-session endpoint limits
- Prompt classification and degraded/blocked responses
- Strict photo payload guardrails
- Structured security telemetry with request IDs

## Residual Risks
- No WAF / L7 bot mitigation outside app layer
- No Redis-backed distributed session/rate limiter yet
- No full user-auth mapping (anonymous-only stage)
- Limited threat intelligence and anomaly alerting

## Next High-Value Steps
1. Redis-backed distributed rate/session store for multi-node setups
2. Provider-side budget limits and alert hooks
3. Dedicated SIEM pipeline for `security` log category
4. E2E abuse scenarios in CI (burst, cooldown, prompt attack corpora)
