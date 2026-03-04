alter table public.missions
  add column if not exists instructions text not null default 'Complete this mission.';

create or replace function public.uncomplete_mission_v1(
  p_mission_id uuid,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_date date;
  v_mission record;
  v_history record;
  v_profile_power integer;
  v_squad_current integer;
  v_squad_max integer;
begin
  select cycle_date
    into v_cycle_date
  from public.squad_state
  where id = 1
  for update;

  select id, profile_id, is_active, recurring_daily
    into v_mission
  from public.missions
  where id = p_mission_id
    and profile_id = p_profile_id;

  if v_mission.id is null or v_mission.is_active is false then
    raise exception 'Mission unavailable';
  end if;

  if v_mission.recurring_daily then
    select id, points_awarded
      into v_history
    from public.mission_history
    where mission_id = p_mission_id
      and profile_id = p_profile_id
      and completed_on_local_date = v_cycle_date
    order by completed_at desc
    limit 1;
  else
    select id, points_awarded
      into v_history
    from public.mission_history
    where mission_id = p_mission_id
      and profile_id = p_profile_id
    order by completed_at desc
    limit 1;
  end if;

  if v_history.id is null then
    select power_level
      into v_profile_power
    from public.profiles
    where id = p_profile_id;

    select squad_power_current, squad_power_max
      into v_squad_current, v_squad_max
    from public.squad_state
    where id = 1;

    return jsonb_build_object(
      'undone', false,
      'was_completed', false,
      'profile_power_level', coalesce(v_profile_power, 0),
      'squad_power_current', coalesce(v_squad_current, 0),
      'squad_power_max', coalesce(v_squad_max, 100)
    );
  end if;

  delete from public.mission_history
  where id = v_history.id;

  update public.profiles
  set power_level = greatest(0, power_level - v_history.points_awarded)
  where id = p_profile_id
  returning power_level into v_profile_power;

  update public.squad_state
  set squad_power_current = greatest(0, squad_power_current - v_history.points_awarded)
  where id = 1
  returning squad_power_current, squad_power_max
  into v_squad_current, v_squad_max;

  insert into public.squad_events (source_type, source_id, delta, note)
  values ('mission', p_mission_id, -v_history.points_awarded, 'undo');

  return jsonb_build_object(
    'undone', true,
    'was_completed', true,
    'profile_power_level', coalesce(v_profile_power, 0),
    'squad_power_current', coalesce(v_squad_current, 0),
    'squad_power_max', coalesce(v_squad_max, 100)
  );
end;
$$;
