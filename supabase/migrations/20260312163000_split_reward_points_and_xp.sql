alter table public.profiles
  add column if not exists reward_points integer not null default 0;

update public.profiles
set reward_points = power_level
where reward_points = 0
  and power_level <> 0;

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
  v_profile_reward_points integer;
  v_profile_xp_points integer;
  v_squad_current integer;
  v_squad_max integer;
  v_already_completed boolean;
begin
  if exists (
    select 1
    from public.mission_history
    where client_request_id = p_client_request_id
  ) then
    select reward_points, power_level
      into v_profile_reward_points, v_profile_xp_points
    from public.profiles
    where id = p_profile_id;

    select squad_power_current, squad_power_max
      into v_squad_current, v_squad_max
    from public.squad_state
    where id = 1;

    return jsonb_build_object(
      'awarded', false,
      'already_completed', true,
      'profile_reward_points', coalesce(v_profile_reward_points, 0),
      'profile_xp_points', coalesce(v_profile_xp_points, 0),
      'profile_power_level', coalesce(v_profile_xp_points, 0),
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
    select reward_points, power_level
      into v_profile_reward_points, v_profile_xp_points
    from public.profiles
    where id = p_profile_id;

    select squad_power_current, squad_power_max
      into v_squad_current, v_squad_max
    from public.squad_state
    where id = 1;

    return jsonb_build_object(
      'awarded', false,
      'already_completed', true,
      'profile_reward_points', coalesce(v_profile_reward_points, 0),
      'profile_xp_points', coalesce(v_profile_xp_points, 0),
      'profile_power_level', coalesce(v_profile_xp_points, 0),
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
  set
    reward_points = reward_points + v_mission.power_value,
    power_level = power_level + v_mission.power_value
  where id = p_profile_id
  returning reward_points, power_level
  into v_profile_reward_points, v_profile_xp_points;

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
    'profile_reward_points', coalesce(v_profile_reward_points, 0),
    'profile_xp_points', coalesce(v_profile_xp_points, 0),
    'profile_power_level', coalesce(v_profile_xp_points, 0),
    'squad_power_current', coalesce(v_squad_current, 0),
    'squad_power_max', coalesce(v_squad_max, 1000)
  );
end;
$$;

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
  v_profile_reward_points integer;
  v_profile_xp_points integer;
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
    select reward_points, power_level
      into v_profile_reward_points, v_profile_xp_points
    from public.profiles
    where id = p_profile_id;

    select squad_power_current, squad_power_max
      into v_squad_current, v_squad_max
    from public.squad_state
    where id = 1;

    return jsonb_build_object(
      'undone', false,
      'was_completed', false,
      'profile_reward_points', coalesce(v_profile_reward_points, 0),
      'profile_xp_points', coalesce(v_profile_xp_points, 0),
      'profile_power_level', coalesce(v_profile_xp_points, 0),
      'squad_power_current', coalesce(v_squad_current, 0),
      'squad_power_max', coalesce(v_squad_max, 1000)
    );
  end if;

  delete from public.mission_history
  where id = v_history.id;

  update public.profiles
  set
    reward_points = greatest(0, reward_points - v_history.points_awarded),
    power_level = greatest(0, power_level - v_history.points_awarded)
  where id = p_profile_id
  returning reward_points, power_level
  into v_profile_reward_points, v_profile_xp_points;

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
    'profile_reward_points', coalesce(v_profile_reward_points, 0),
    'profile_xp_points', coalesce(v_profile_xp_points, 0),
    'profile_power_level', coalesce(v_profile_xp_points, 0),
    'squad_power_current', coalesce(v_squad_current, 0),
    'squad_power_max', coalesce(v_squad_max, 1000)
  );
end;
$$;

create or replace function public.claim_reward_v1(
  p_profile_id uuid,
  p_reward_id uuid,
  p_image_url text default null,
  p_sticker_type text default null,
  p_sticker_concept_id text default null,
  p_sticker_prompt_seed text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_reward record;
  v_new_reward_points integer;
  v_claimed_at timestamptz;
begin
  select id, hero_name, reward_points, power_level
    into v_profile
  from public.profiles
  where id = p_profile_id
  for update;

  if v_profile.id is null then
    raise exception 'Profile not found';
  end if;

  select id, title, description, point_cost, is_active, sort_order
    into v_reward
  from public.rewards
  where id = p_reward_id;

  if v_reward.id is null or v_reward.is_active is false then
    raise exception 'Reward unavailable';
  end if;

  if v_profile.reward_points < v_reward.point_cost then
    return jsonb_build_object(
      'claimed', false,
      'insufficient_points', true,
      'new_reward_points', v_profile.reward_points,
      'new_xp_points', v_profile.power_level,
      'new_power_level', v_profile.power_level,
      'reward', jsonb_build_object(
        'id', v_reward.id,
        'title', v_reward.title,
        'description', v_reward.description,
        'point_cost', v_reward.point_cost,
        'is_active', v_reward.is_active,
        'sort_order', v_reward.sort_order
      )
    );
  end if;

  update public.profiles
  set reward_points = greatest(0, reward_points - v_reward.point_cost)
  where id = p_profile_id
  returning reward_points into v_new_reward_points;

  v_claimed_at := now();

  insert into public.reward_claims (
    profile_id,
    reward_id,
    point_cost,
    image_url,
    claimed_at,
    sticker_type,
    sticker_concept_id,
    sticker_prompt_seed
  )
  values (
    p_profile_id,
    p_reward_id,
    v_reward.point_cost,
    p_image_url,
    v_claimed_at,
    p_sticker_type,
    p_sticker_concept_id,
    p_sticker_prompt_seed
  );

  insert into public.notifications (
    profile_id,
    event_type,
    title,
    message
  )
  values (
    p_profile_id,
    'reward_claimed',
    'Reward Claimed',
    coalesce(v_profile.hero_name, 'Hero') || ' claimed "' || v_reward.title || '" (-' || v_reward.point_cost::text || ' reward points).'
  );

  return jsonb_build_object(
    'claimed', true,
    'insufficient_points', false,
    'new_reward_points', coalesce(v_new_reward_points, 0),
    'new_xp_points', coalesce(v_profile.power_level, 0),
    'new_power_level', coalesce(v_profile.power_level, 0),
    'reward', jsonb_build_object(
      'id', v_reward.id,
      'title', v_reward.title,
      'description', v_reward.description,
      'point_cost', v_reward.point_cost,
      'is_active', v_reward.is_active,
      'sort_order', v_reward.sort_order
    )
  );
end;
$$;
