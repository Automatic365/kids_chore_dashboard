# HeroHabits Domain Invariants

## Mission Completion

1. Recurring mission awards at most once per cycle date.
2. Non-recurring mission awards once total.
3. Duplicate completion requests must be idempotent.

## Undo Rules

1. Undo only applies to existing completion rows.
2. Undo is blocked if points were already spent and caller is not forcing undo.
3. Force undo is parent-only.

## Reward Economy

1. Reward claim deducts profile power by reward cost.
2. Reward claim is single-claim per profile/reward pair in current model.
3. Reward return deletes claim and restores previously deducted power.

## Squad Meter

1. Squad power is clamped between `0` and `squadPowerMax`.
2. Mission completion and undo adjust both personal and squad power consistently.

## Streaks

1. Streak increments only on first completion for the profile in a cycle date.
2. Streak resets to 1 after gaps.

## Enforcement Points

- Shared rule helpers: `src/lib/game-rules.ts`
- Local IndexedDB path: `src/lib/local-data.ts`
- Local server store: `src/lib/server/local-store.ts`
- Supabase undo policy check: `src/lib/server/repository.ts`
