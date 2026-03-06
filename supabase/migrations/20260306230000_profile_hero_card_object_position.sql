alter table public.profiles
  add column if not exists hero_card_object_position text default 'center';

update public.profiles
set hero_card_object_position = 'center'
where hero_card_object_position is null;
