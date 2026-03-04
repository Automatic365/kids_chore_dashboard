# HeroHabits Release Checklist

## 1) Launch Mode Decision

- [ ] Free local-only mode (recommended for zero-cost): `NEXT_PUBLIC_USE_REMOTE_API=false`
- [ ] Remote sync mode (Supabase): `NEXT_PUBLIC_USE_REMOTE_API=true` and Supabase env vars set

## 2) Real Device QA

Run through the full loop on each target:

- [ ] iPhone Safari (portrait)
- [ ] Android Chrome (portrait)
- [ ] iPad/tablet PWA (landscape preferred)
- [ ] Desktop browser

Verify:

- [ ] Kid mission complete + undo works
- [ ] Parent PIN entry works from hidden trigger and `/parent`
- [ ] Parent autosave edits persist
- [ ] Parent trash + restore works
- [ ] AI mission generation works for selected provider
- [ ] Squad power meter updates correctly

## 3) Daily Reset Automation (Free)

- [ ] Add repo secrets:
  - `DAILY_RESET_URL` (for example `https://your-app.vercel.app`)
  - `INTERNAL_CRON_SECRET` (same value as runtime env)
- [ ] Confirm GitHub Action workflow is enabled:
  - `.github/workflows/daily-reset.yml`
- [ ] Trigger once manually using `workflow_dispatch` and verify cycle date stays correct

## 4) PWA Update Verification

- [ ] Install app to home screen
- [ ] Deploy a change
- [ ] Confirm app updates without stale UI (service worker update path)
