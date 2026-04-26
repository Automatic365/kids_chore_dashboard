alter table public.mission_history enable row level security;
alter table public.missions enable row level security;
alter table public.squad_events enable row level security;
alter table public.parent_settings enable row level security;
alter table public.rewards enable row level security;
alter table public.profiles enable row level security;
alter table public.squad_state enable row level security;
alter table public.notifications enable row level security;
alter table public.reward_claims enable row level security;

drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read
  on public.profiles
  for select
  to anon, authenticated
  using (true);

drop policy if exists missions_public_read on public.missions;
create policy missions_public_read
  on public.missions
  for select
  to anon, authenticated
  using (true);

drop policy if exists mission_history_public_read on public.mission_history;
create policy mission_history_public_read
  on public.mission_history
  for select
  to anon, authenticated
  using (true);

drop policy if exists squad_state_public_read on public.squad_state;
create policy squad_state_public_read
  on public.squad_state
  for select
  to anon, authenticated
  using (true);
