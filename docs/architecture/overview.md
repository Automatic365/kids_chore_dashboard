# HeroHabits Architecture Overview

## Core Runtime Model

HeroHabits is local-first by default.

- **UI**: Next.js App Router + React + Tailwind
- **Primary persistence**: IndexedDB (`src/lib/local-data.ts`)
- **Optional persistence**: Supabase via repository abstraction (`src/lib/server/repository.ts`)
- **Authoritative default mode**: `NEXT_PUBLIC_USE_REMOTE_API=false`

## System Boundaries

- **Kids surface**: public mission/reward endpoints + local fallback path
- **Parent surface**: PIN/session-gated mutation endpoints
- **Ops surface**: internal daily reset endpoint guarded by `INTERNAL_CRON_SECRET`

## Data Flow

1. Client calls `src/lib/client-api.ts`.
2. If remote API is disabled, local adapter is used directly.
3. If remote API is enabled, route handlers call repository methods.
4. Repository resolves to local store or Supabase implementation.

## Reset and Time Semantics

- Cycle date is interpreted in `APP_TIME_ZONE` (default `America/Chicago`).
- Reset endpoint sets cycle date; mission completion rules use cycle date for once-per-day semantics.

## Design Constraints

- Must remain free-hostable with no paid infrastructure required.
- Must preserve role separation: kids cannot access parent-only mutations.
- Must preserve deterministic mission economy under retries and undo/reward chains.
