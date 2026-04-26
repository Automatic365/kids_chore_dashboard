alter table public.rewards
  add column if not exists min_days_between_claims integer;

alter table public.rewards
  drop constraint if exists rewards_min_days_between_claims_check;

alter table public.rewards
  add constraint rewards_min_days_between_claims_check check (
    min_days_between_claims is null
    or (min_days_between_claims >= 1 and min_days_between_claims <= 365)
  );

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
  v_cycle_date date;
  v_latest_claimed_at timestamptz;
  v_latest_claim_date date;
  v_next_claim_date date;
  v_cooldown_days_remaining integer;
begin
  select id, hero_name, reward_points, power_level
    into v_profile
  from public.profiles
  where id = p_profile_id
  for update;

  if v_profile.id is null then
    raise exception 'Profile not found';
  end if;

  select cycle_date
    into v_cycle_date
  from public.squad_state
  where id = 1;

  select
    id,
    title,
    description,
    point_cost,
    target_days_to_earn,
    min_days_between_claims,
    is_active,
    sort_order
    into v_reward
  from public.rewards
  where id = p_reward_id;

  if v_reward.id is null or v_reward.is_active is false then
    raise exception 'Reward unavailable';
  end if;

  if v_reward.min_days_between_claims is not null then
    select claimed_at
      into v_latest_claimed_at
    from public.reward_claims
    where profile_id = p_profile_id
      and reward_id = p_reward_id
    order by claimed_at desc
    limit 1;

    if v_latest_claimed_at is not null then
      v_latest_claim_date := (v_latest_claimed_at at time zone 'America/Chicago')::date;
      v_next_claim_date := v_latest_claim_date + v_reward.min_days_between_claims;
      v_cooldown_days_remaining := greatest(0, v_next_claim_date - v_cycle_date);

      if v_cycle_date < v_next_claim_date then
        return jsonb_build_object(
          'claimed', false,
          'insufficient_points', false,
          'cooldown_active', true,
          'next_claim_date', v_next_claim_date::text,
          'cooldown_days_remaining', v_cooldown_days_remaining,
          'new_reward_points', v_profile.reward_points,
          'new_xp_points', v_profile.power_level,
          'new_power_level', v_profile.power_level,
          'reward', jsonb_build_object(
            'id', v_reward.id,
            'title', v_reward.title,
            'description', v_reward.description,
            'point_cost', v_reward.point_cost,
            'target_days_to_earn', v_reward.target_days_to_earn,
            'min_days_between_claims', v_reward.min_days_between_claims,
            'is_active', v_reward.is_active,
            'sort_order', v_reward.sort_order
          )
        );
      end if;
    end if;
  end if;

  if v_profile.reward_points < v_reward.point_cost then
    return jsonb_build_object(
      'claimed', false,
      'insufficient_points', true,
      'cooldown_active', false,
      'next_claim_date', null,
      'cooldown_days_remaining', null,
      'new_reward_points', v_profile.reward_points,
      'new_xp_points', v_profile.power_level,
      'new_power_level', v_profile.power_level,
      'reward', jsonb_build_object(
        'id', v_reward.id,
        'title', v_reward.title,
        'description', v_reward.description,
        'point_cost', v_reward.point_cost,
        'target_days_to_earn', v_reward.target_days_to_earn,
        'min_days_between_claims', v_reward.min_days_between_claims,
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
    'cooldown_active', false,
    'next_claim_date', null,
    'cooldown_days_remaining', null,
    'new_reward_points', coalesce(v_new_reward_points, 0),
    'new_xp_points', coalesce(v_profile.power_level, 0),
    'new_power_level', coalesce(v_profile.power_level, 0),
    'reward', jsonb_build_object(
      'id', v_reward.id,
      'title', v_reward.title,
      'description', v_reward.description,
      'point_cost', v_reward.point_cost,
      'target_days_to_earn', v_reward.target_days_to_earn,
      'min_days_between_claims', v_reward.min_days_between_claims,
      'is_active', v_reward.is_active,
      'sort_order', v_reward.sort_order
    )
  );
end;
$$;
