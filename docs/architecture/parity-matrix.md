# Local vs Remote Parity Matrix

## Capability Matrix

| Capability | Local First | Public/Parent API | Supabase Repository |
|---|---|---|---|
| Complete mission | ✅ | ✅ | ✅ |
| Undo mission (force gate) | ✅ | ✅ | ✅ |
| Claim reward | ✅ | ✅ | ✅ (requires rewards migration) |
| Return reward | ✅ | ✅ | ✅ (requires rewards migration) |
| Reward CRUD | ✅ | ✅ | ✅ (requires rewards migration) |
| Squad goal set/clear | ✅ | ✅ | ✅ (requires rewards migration) |
| Mission history | ✅ | ✅ | ✅ |
| Parent notifications feed | ✅ | ✅ | ✅ (requires notifications migration) |
| Public unread notification badge count | ✅ | ✅ | ✅ (requires notifications migration) |
| Daily reset | ✅ | ✅ | ✅ (`daily_reset_v1`) |

## Fallback Policy

- Primary supported mode: `NEXT_PUBLIC_USE_REMOTE_API=false`.
- Remote mode should be used only when Supabase migrations are applied (including `20260306180500_rewards_claims_and_squad_goal.sql` and `20260306194000_notifications_and_claim_reward_rpc.sql`).
- If migrations are missing, Supabase APIs will fail with table/column errors until migration completion.

## Known Intentional Gaps

- None at the repository code layer.
- Free local-first remains the baseline mode when operators do not want cloud schema management.
