alter table public.missions
  add column if not exists recurring_daily boolean not null default true;

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
      'squad_power_max', coalesce(v_squad_max, 100)
    );
  end if;

  select cycle_date
    into v_cycle_date
  from public.squad_state
  where id = 1
  for update;

  select id, profile_id, power_value, is_active, recurring_daily
    into v_mission
  from public.missions
  where id = p_mission_id
    and profile_id = p_profile_id;

  if v_mission.id is null or v_mission.is_active is false then
    raise exception 'Mission unavailable';
  end if;

  if v_mission.recurring_daily then
    select exists(
      select 1
      from public.mission_history
      where mission_id = p_mission_id
        and completed_on_local_date = v_cycle_date
    ) into v_already_completed;
  else
    select exists(
      select 1
      from public.mission_history
      where mission_id = p_mission_id
    ) into v_already_completed;
  end if;

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
      'squad_power_max', coalesce(v_squad_max, 100)
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
    'squad_power_max', coalesce(v_squad_max, 100)
  );
end;
$$;
