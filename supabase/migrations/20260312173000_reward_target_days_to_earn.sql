alter table public.rewards
  add column if not exists target_days_to_earn integer;

alter table public.rewards
  drop constraint if exists rewards_target_days_to_earn_check;

alter table public.rewards
  add constraint rewards_target_days_to_earn_check check (
    target_days_to_earn is null
    or (target_days_to_earn >= 1 and target_days_to_earn <= 30)
  );
