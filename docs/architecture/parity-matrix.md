# Local vs Remote Parity Matrix

## Capability Matrix

| Capability | Local First | Public/Parent API | Supabase Repository |
|---|---|---|---|
| Complete mission | ✅ | ✅ | ✅ |
| Undo mission (force gate) | ✅ | ✅ | ✅ |
| Claim reward | ✅ | ✅ | ❌ (migration required) |
| Return reward | ✅ | ✅ | ❌ (migration required) |
| Reward CRUD | ✅ | ✅ | ❌ (migration required) |
| Squad goal set/clear | ✅ | ✅ | ❌ (migration required) |
| Mission history | ✅ | ✅ | ✅ |
| Daily reset | ✅ | ✅ | ✅ (`daily_reset_v1`) |

## Fallback Policy

- Primary supported mode: `NEXT_PUBLIC_USE_REMOTE_API=false`.
- Remote mode should be used only when Supabase schema/functions are applied.
- Unsupported Supabase capabilities return actionable errors instructing local-first mode or migration completion.

## Known Intentional Gaps

- Reward and squad-goal features in Supabase mode still require migration/RPC implementation.
- This is acceptable for free local-first baseline operation.
