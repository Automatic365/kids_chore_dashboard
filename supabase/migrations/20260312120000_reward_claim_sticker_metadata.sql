alter table public.reward_claims
  add column if not exists sticker_type text,
  add column if not exists sticker_concept_id text,
  add column if not exists sticker_prompt_seed text;

alter table public.reward_claims
  drop constraint if exists reward_claims_sticker_type_check;

alter table public.reward_claims
  add constraint reward_claims_sticker_type_check check (
    sticker_type is null or sticker_type in ('vehicle', 'companion')
  );

create index if not exists reward_claims_profile_sticker_concept_idx
  on public.reward_claims (profile_id, sticker_concept_id)
  where sticker_concept_id is not null;

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
  v_new_power integer;
  v_claimed_at timestamptz;
begin
  select id, hero_name, power_level
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

  if v_profile.power_level < v_reward.point_cost then
    return jsonb_build_object(
      'claimed', false,
      'insufficient_points', true,
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
  set power_level = greatest(0, power_level - v_reward.point_cost)
  where id = p_profile_id
  returning power_level into v_new_power;

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
    coalesce(v_profile.hero_name, 'Hero') || ' claimed "' || v_reward.title || '" (-' || v_reward.point_cost::text || ' power).'
  );

  return jsonb_build_object(
    'claimed', true,
    'insufficient_points', false,
    'new_power_level', v_new_power,
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
