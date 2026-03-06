create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('mission_complete', 'reward_claimed', 'reward_returned')),
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_created_at_idx
  on public.notifications (created_at desc);

create index if not exists notifications_unread_idx
  on public.notifications (read_at)
  where read_at is null;

create or replace function public.claim_reward_v1(
  p_profile_id uuid,
  p_reward_id uuid,
  p_image_url text default null
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
    claimed_at
  )
  values (
    p_profile_id,
    p_reward_id,
    v_reward.point_cost,
    p_image_url,
    v_claimed_at
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

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
