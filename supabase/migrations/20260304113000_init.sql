create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  hero_name text not null,
  avatar_url text not null,
  ui_mode text not null check (ui_mode in ('text', 'picture')),
  power_level integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  image_url text,
  power_value integer not null check (power_value > 0),
  is_active boolean not null default true,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mission_history (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  completed_on_local_date date not null,
  client_request_id text not null unique,
  points_awarded integer not null,
  created_at timestamptz not null default now()
);

create unique index if not exists mission_history_daily_completion_idx
  on public.mission_history (mission_id, completed_on_local_date);

create table if not exists public.squad_state (
  id integer primary key default 1,
  squad_power_current integer not null default 0,
  squad_power_max integer not null default 1000,
  cycle_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (id = 1)
);

create table if not exists public.squad_events (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('mission', 'manual')),
  source_id uuid,
  delta integer not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.parent_settings (
  id integer primary key default 1,
  pin_hash text not null,
  pin_updated_at timestamptz not null default now(),
  check (id = 1)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_missions_updated_at on public.missions;
create trigger set_missions_updated_at
before update on public.missions
for each row execute function public.set_updated_at();

drop trigger if exists set_squad_state_updated_at on public.squad_state;
create trigger set_squad_state_updated_at
before update on public.squad_state
for each row execute function public.set_updated_at();

create or replace function public.complete_mission_v1(
  p_mission_id uuid,
  p_profile_id uuid,
  p_client_request_id text,
  p_completed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_date date;
  v_mission record;
  v_profile_power integer;
  v_squad_current integer;
  v_squad_max integer;
  v_already_completed boolean;
begin
  if exists (
    select 1
    from public.mission_history
    where client_request_id = p_client_request_id
  ) then
    select power_level
      into v_profile_power
    from public.profiles
    where id = p_profile_id;

    select squad_power_current, squad_power_max
      into v_squad_current, v_squad_max
    from public.squad_state
    where id = 1;

    return jsonb_build_object(
      'awarded', false,
      'already_completed', true,
      'profile_power_level', coalesce(v_profile_power, 0),
      'squad_power_current', coalesce(v_squad_current, 0),
      'squad_power_max', coalesce(v_squad_max, 1000)
    );
  end if;

  select cycle_date
    into v_cycle_date
  from public.squad_state
  where id = 1
  for update;

  select id, profile_id, power_value, is_active
    into v_mission
  from public.missions
  where id = p_mission_id
    and profile_id = p_profile_id;

  if v_mission.id is null or v_mission.is_active is false then
    raise exception 'Mission unavailable';
  end if;

  select exists(
    select 1
    from public.mission_history
    where mission_id = p_mission_id
      and completed_on_local_date = v_cycle_date
  ) into v_already_completed;

  if v_already_completed then
    select power_level
      into v_profile_power
    from public.profiles
    where id = p_profile_id;

    select squad_power_current, squad_power_max
      into v_squad_current, v_squad_max
    from public.squad_state
    where id = 1;

    return jsonb_build_object(
      'awarded', false,
      'already_completed', true,
      'profile_power_level', coalesce(v_profile_power, 0),
      'squad_power_current', coalesce(v_squad_current, 0),
      'squad_power_max', coalesce(v_squad_max, 1000)
    );
  end if;

  insert into public.mission_history (
    mission_id,
    profile_id,
    completed_at,
    completed_on_local_date,
    client_request_id,
    points_awarded
  )
  values (
    p_mission_id,
    p_profile_id,
    p_completed_at,
    v_cycle_date,
    p_client_request_id,
    v_mission.power_value
  );

  update public.profiles
  set power_level = power_level + v_mission.power_value
  where id = p_profile_id
  returning power_level into v_profile_power;

  update public.squad_state
  set squad_power_current = least(
    squad_power_max,
    greatest(0, squad_power_current + v_mission.power_value)
  )
  where id = 1
  returning squad_power_current, squad_power_max
  into v_squad_current, v_squad_max;

  insert into public.squad_events (source_type, source_id, delta, note)
  values ('mission', p_mission_id, v_mission.power_value, null);

  return jsonb_build_object(
    'awarded', true,
    'already_completed', false,
    'profile_power_level', coalesce(v_profile_power, 0),
    'squad_power_current', coalesce(v_squad_current, 0),
    'squad_power_max', coalesce(v_squad_max, 1000)
  );
end;
$$;

create or replace function public.daily_reset_v1(p_cycle_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.squad_state
  set cycle_date = p_cycle_date
  where id = 1;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'squad_state'
  ) then
    alter publication supabase_realtime add table public.squad_state;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mission_history'
  ) then
    alter publication supabase_realtime add table public.mission_history;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'missions'
  ) then
    alter publication supabase_realtime add table public.missions;
  end if;
end;
$$;
