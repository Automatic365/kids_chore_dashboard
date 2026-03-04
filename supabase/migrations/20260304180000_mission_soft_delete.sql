alter table public.missions
  add column if not exists deleted_at timestamptz;

create index if not exists missions_deleted_at_idx
  on public.missions (deleted_at);
