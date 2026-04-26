# HeroHabits: Super Squad

Tablet-first (and desktop/mobile-capable) chore game built with Next.js App Router + Tailwind.

## Purpose

HeroHabits turns everyday chores and positive behavior into superhero missions for young kids.
The app is designed to reduce parent nagging, increase child motivation with instant feedback,
and build teamwork through a shared squad progress meter.

It supports:

- A text-first mission board for early readers.
- A picture-first mission board with large touch targets for toddlers.
- A parent command center to manage tasks, award points, and monitor progress.

## Features

- Bifurcated kid UI.
- Text mission mode for readers.
- Picture mission mode with large touch targets for younger kids.
- Parent dashboard protected by PIN-backed session cookie.
- Shared squad meter that updates as missions complete.
- Once-per-day mission completion with idempotent request handling.
- Undo support for accidental mission completion taps.
- Mission instructions/write-ups shown on cards and editable by parents.
- Parent trash/restore safety net for missions (soft delete).
- Offline queue for mission completion replay when back online.
- Installable PWA shell with service worker + manifest.
- Free-first local persistence via browser IndexedDB (no required backend).
- Optional remote mode via API + Supabase.
- Optional AI mission generator from plain task lists.
- Parent success/error toasts for key dashboard actions.
- Parent notification feed with unread badge on the kid board.
- Themed in-app confirmation dialogs (no browser-native confirm popups).
- Report-only CSP headers with optional Sentry error reporting.

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` - start Next.js dev server.
- `npm run build` - production build.
- `npm run start` - run production server.
- `npm run lint` - run ESLint.
- `npm run test` - run Vitest unit tests.
- `npm run test:watch` - watch-mode unit tests.
- `npm run e2e` - run Playwright smoke tests.

## Free Hosting Mode (Recommended)

This mode keeps the app maintainable with no required paid services.

1. Set in `.env.local`:
   - `NEXT_PUBLIC_USE_REMOTE_API=false`
2. Deploy normally (`npm run build`) to a free host that supports Next.js (for example Vercel Hobby).
3. Data persists on each device in browser IndexedDB.

Important tradeoff:
- Device data is local-only in free mode. If you use multiple devices, they do not auto-sync without remote mode.
- AI mission generation requires an OpenAI or Gemini API key (paid API usage).

## Supabase Setup

Use this only if you want cloud sync/API-backed mode.

1. Create a Supabase project.
2. Apply all SQL files in `supabase/migrations` in timestamp order.
3. Update `supabase/seed.sql` with a real `pin_hash` value.
4. Run seed SQL.
5. Set `NEXT_PUBLIC_USE_REMOTE_API=true` in `.env.local`.
6. Configure `.env.local` with Supabase keys.

Required for cross-device image consistency:
- Migration `20260307114000_storage_hero_media_bucket.sql` creates public bucket `hero-media`.
- Migration `20260311101500_expand_hero_media_types_and_size.sql` expands upload support (HEIC/HEIF) and raises limit to 10MB.
- Parent image uploads use `/api/parent/media/upload` and store URLs from this bucket.

### PIN Hash

PIN verification uses:

```text
sha256("<PIN>:<PARENT_PIN_PEPPER>")
```

Set either `PARENT_PIN_HASH` (recommended) or `PARENT_PIN_PLAIN` for local-only development.

## Daily Reset

Call `POST /api/internal/daily-reset` with header:

- `x-internal-secret: <INTERNAL_CRON_SECRET>`

Use a scheduler (Supabase cron, GitHub Action, or Vercel cron) to call this endpoint at local midnight in `America/Chicago`.

Free default included in this repo:
- GitHub Actions workflow at `.github/workflows/daily-reset.yml` (runs hourly and calls the reset endpoint).
- The endpoint itself computes cycle date in `APP_TIME_ZONE`, so hourly execution is safe.

Set repository secrets:
- `DAILY_RESET_URL` (for example `https://your-app.vercel.app`)
- `INTERNAL_CRON_SECRET` (must match runtime env)

## AI Mission Generator

Mission Command includes an **AI Mission Generator** section:

1. Choose a hero.
2. Choose AI provider (OpenAI or Gemini).
3. Paste one task per line.
4. Generate mission names + write-ups.
5. Add individual suggestions or add all.

Set in `.env.local`:

- `OPENAI_API_KEY=<your key>`
- `OPENAI_MODEL=gpt-4o-mini` (or another compatible model)
- `GEMINI_API_KEY=<your key>`
- `GEMINI_MODEL=gemini-2.0-flash-lite` (or another compatible model)
- `SENTRY_DSN=<your DSN>` (optional)
- `NEXT_PUBLIC_SENTRY_DSN=<your DSN>` (optional)

If no key is set, the app falls back to deterministic non-AI mission generation.

## Notes

- In local-only mode, file uploads are stored as data URLs in browser storage (device-local).
- In remote mode (`NEXT_PUBLIC_USE_REMOTE_API=true`), parent file uploads are stored in Supabase Storage (`hero-media`) and are consistent across devices/incognito.
- Default demo data is preloaded in local fallback mode.
- Release checklist: see `docs/release-checklist.md`.
- Architecture docs:
  - `docs/architecture/overview.md`
  - `docs/architecture/invariants.md`
  - `docs/architecture/parity-matrix.md`
  - `docs/architecture/state-machine.md`
- Ops docs:
  - `docs/ops/daily-reset-runbook.md`
  - CSP reports are accepted at `POST /api/internal/csp-report`
