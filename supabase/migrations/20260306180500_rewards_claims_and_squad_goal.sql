create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  point_cost integer not null check (point_cost > 0),
  is_active boolean not null default true,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_rewards_updated_at on public.rewards;
create trigger set_rewards_updated_at
before update on public.rewards
for each row execute function public.set_updated_at();

create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete cascade,
  point_cost integer not null check (point_cost > 0),
  image_url text,
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists reward_claims_profile_claimed_at_idx
  on public.reward_claims (profile_id, claimed_at desc);

create index if not exists rewards_sort_order_idx
  on public.rewards (sort_order);

alter table public.squad_state
  add column if not exists squad_goal_title text,
  add column if not exists squad_goal_target_power integer,
  add column if not exists squad_goal_reward_description text;

alter table public.squad_state
  drop constraint if exists squad_goal_target_positive_check;

alter table public.squad_state
  add constraint squad_goal_target_positive_check check (
    squad_goal_target_power is null or squad_goal_target_power > 0
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reward_claims'
  ) then
    alter publication supabase_realtime add table public.reward_claims;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rewards'
  ) then
    alter publication supabase_realtime add table public.rewards;
  end if;
end;
$$;
