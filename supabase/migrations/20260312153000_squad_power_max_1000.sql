alter table public.squad_state
  alter column squad_power_max set default 1000;

update public.squad_state
set squad_power_max = 1000
where squad_power_max < 1000;
