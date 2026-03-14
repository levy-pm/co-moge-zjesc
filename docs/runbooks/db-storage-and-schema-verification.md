# DB Storage And Schema Verification

## Scope
This checklist verifies:
- production startup hard-fails without DB
- runtime does not fall back to file storage on production
- recipe schema contains `source` and `author_user_id`
- old records remain compatible

## 1) Runtime checks (after deploy)
Run:
```bash
curl -fsS https://<host>/backend/health
curl -fsS https://<host>/backend/readiness
```

Expected:
- `storage` is `mysql`
- `dbReady` is `true`
- `dbRequired` is `true`
- `fileStoreFallbackAllowed` is `false`
- readiness response has `ok: true`

If `dbRequired=true` and `storage=file`, treat as deployment failure.

## 2) Environment guardrails
Production must not run with silent fallback:
- `NODE_ENV=production`
- do not set `ALLOW_FILE_STORE_FALLBACK=true`
- keep DB config present (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)

Optional explicit hardening:
- set `REQUIRE_DB=true` in production environment

## 3) SQL schema verification
Run on production DB:
```sql
SHOW COLUMNS FROM recipes;
```

Confirm these columns exist:
- `kategoria`
- `status`
- `source`
- `author_user_id`

Confirm data compatibility:
```sql
SELECT COUNT(*) AS invalid_source
FROM recipes
WHERE source IS NULL
   OR source = ''
   OR source NOT IN ('administrator', 'uzytkownik', 'internet');

SELECT COUNT(*) AS invalid_author
FROM recipes
WHERE author_user_id IS NOT NULL
  AND author_user_id <= 0;
```

Expected:
- `invalid_source = 0`
- `invalid_author = 0`

## 4) End-to-end functional verification
1. Register/login as user.
2. Create recipe from user flow.
3. Confirm user sees it in `Moje przepisy`.
4. Login to admin and verify the same recipe is visible.
5. Verify recipe has `source=uzytkownik` and non-null `author_user_id`.

## 5) Failure response
If checks fail:
1. Enable maintenance mode.
2. Roll back using rollback runbook.
3. Fix DB config/schema.
4. Redeploy and repeat checks 1-4.
