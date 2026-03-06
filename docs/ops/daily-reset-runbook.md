# Daily Reset Runbook

## Purpose

Diagnose and recover failures for `POST /api/internal/daily-reset`.

## Required Configuration

- Runtime env: `INTERNAL_CRON_SECRET`, `APP_TIME_ZONE`
- Scheduler secret: `INTERNAL_CRON_SECRET` (must match runtime)
- Scheduler URL: `DAILY_RESET_URL`

## Fast Verification

```bash
curl -i -X POST \
  -H "x-internal-secret: <INTERNAL_CRON_SECRET>" \
  -H "x-request-id: manual-reset-check" \
  https://<host>/api/internal/daily-reset
```

Expected: `200` and JSON with `ok: true`.

## Automated Verification

Run API-level reset behavior tests locally:

```bash
npm run test -- src/app/api/internal/daily-reset/route.test.ts
```

This test file verifies:
- Unauthorized response when internal secret is invalid or missing.
- Authorized reset success path.
- Error mapping for reset failures.
- Request-id presence in responses.

## Common Failure Modes

1. `401 UNAUTHORIZED`
- Cause: secret mismatch
- Fix: align GitHub/Vercel secret values exactly

2. Non-200 with redirect history
- Cause: scheduler URL redirects unexpectedly
- Fix: use canonical production host URL; workflow now follows redirects and logs headers/body

3. `500 RESET_FAILED`
- Cause: repository reset error (often Supabase function/migration mismatch in remote mode)
- Fix: verify `daily_reset_v1` exists and service role key is valid, or run local-first mode

## Recovery Steps

1. Re-run workflow manually with `workflow_dispatch`.
2. Inspect workflow response body and `requestId`.
3. Validate env/secret parity.
4. Trigger manual curl and confirm successful response.

## Post-Incident Checklist

- Confirm new cycle date visible in app.
- Confirm mission completion eligibility for recurring missions reset correctly.
- Record failure cause and mitigation in release notes.

## CSP Report-Only Tuning

- CSP reports are accepted at `POST /api/internal/csp-report`.
- Start with report-only violations in logs/Sentry and tune allowed sources before enforcing.
- Common expected sources to allow: Supabase API host, AI provider API hosts, and app self/data/blob assets.
