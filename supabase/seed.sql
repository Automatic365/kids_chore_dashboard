insert into public.profiles (id, hero_name, avatar_url, ui_mode, power_level)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Captain Comet', '/avatars/captain.svg', 'text', 0),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Super Tot', '/avatars/super.svg', 'picture', 0)
on conflict (id) do nothing;

insert into public.squad_state (id, squad_power_current, squad_power_max, cycle_date)
values (1, 0, 100, current_date)
on conflict (id) do nothing;

insert into public.parent_settings (id, pin_hash)
values (1, 'replace-with-sha256-pin-hash')
on conflict (id) do nothing;

insert into public.missions (
  profile_id,
  title,
  instructions,
  image_url,
  power_value,
  is_active,
  recurring_daily,
  sort_order
)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Operation: Brush Teeth', 'Brush top and bottom teeth for two full minutes, then rinse.', '/missions/brush.svg', 10, true, true, 1),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Defeat Lego Monsters', 'Pick up all Lego pieces and place them in the Lego bin.', '/missions/lego.svg', 12, true, true, 2),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Shield-Up Bedtime', 'Put pajamas on, get in bed, and stay calm for bedtime.', '/missions/bed.svg', 8, true, true, 3),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Toy Bin Attack', 'Put toys in the toy bin until the floor is clear.', '/missions/toys.svg', 8, true, true, 1),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Bed Rescue', 'Climb into bed and pull blanket up for bedtime.', '/missions/bed.svg', 8, true, true, 2),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Toothpaste Zap', 'Use toothbrush with toothpaste and brush with help.', '/missions/brush.svg', 10, true, true, 3)
on conflict do nothing;
