create table public.account_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_vehicle_id uuid,
  connectors text[] not null default '{}',
  max_distance numeric(5,2) not null default 15 check (max_distance between 1 and 30),
  units text not null default 'mi' check (units in ('mi', 'km')),
  notify_email boolean not null default true,
  notify_push boolean not null default true,
  notify_bookings boolean not null default true,
  default_margin numeric(5,2) not null default 40 check (default_margin between 0 and 100),
  theme text not null default 'light' check (theme in ('light', 'dark')),
  updated_at timestamptz not null default now()
);

create table public.account_vehicles (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 100),
  make text not null check (char_length(make) between 1 and 100),
  model text not null check (char_length(model) between 1 and 100),
  year integer not null check (year between 1886 and 2100),
  battery_kwh numeric(7,2) not null check (battery_kwh > 0),
  efficiency numeric(7,3) not null check (efficiency > 0),
  connector text not null check (connector in ('J1772', 'CCS', 'NACS', 'CHAdeMO'))
);

alter table public.account_preferences
  add constraint account_preferences_default_vehicle_id_fkey
  foreign key (default_vehicle_id) references public.account_vehicles(id) on delete set null;

create table public.account_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  charger_id text not null,
  primary key (user_id, charger_id)
);

alter table public.account_preferences enable row level security;
alter table public.account_vehicles enable row level security;
alter table public.account_favorites enable row level security;

create policy "accounts manage own preferences" on public.account_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "accounts manage own vehicles" on public.account_vehicles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "accounts manage own favorites" on public.account_favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create function public.replace_account_data(
  p_favorites text[], p_vehicles jsonb, p_default_vehicle_id uuid,
  p_connectors text[], p_max_distance numeric, p_units text,
  p_notify_email boolean, p_notify_push boolean, p_notify_bookings boolean,
  p_default_margin numeric, p_theme text
)
returns void language plpgsql security invoker set search_path = public as $$
declare account_id uuid := auth.uid();
begin
  if account_id is null then raise exception 'Authentication required'; end if;
  update public.account_preferences set default_vehicle_id = null where user_id = account_id;
  delete from public.account_vehicles where user_id = account_id;
  insert into public.account_vehicles (id, user_id, nickname, make, model, year, battery_kwh, efficiency, connector)
  select id, account_id, nickname, make, model, year, battery_kwh, efficiency, connector
  from jsonb_to_recordset(p_vehicles) as vehicle(id uuid, nickname text, make text, model text, year integer, battery_kwh numeric, efficiency numeric, connector text);
  if p_default_vehicle_id is not null and not exists (select 1 from public.account_vehicles where id = p_default_vehicle_id and user_id = account_id) then
    raise exception 'Default vehicle must belong to this account';
  end if;
  insert into public.account_preferences (user_id, default_vehicle_id, connectors, max_distance, units, notify_email, notify_push, notify_bookings, default_margin, theme, updated_at)
  values (account_id, p_default_vehicle_id, p_connectors, p_max_distance, p_units, p_notify_email, p_notify_push, p_notify_bookings, p_default_margin, p_theme, now())
  on conflict (user_id) do update set default_vehicle_id = excluded.default_vehicle_id, connectors = excluded.connectors, max_distance = excluded.max_distance, units = excluded.units, notify_email = excluded.notify_email, notify_push = excluded.notify_push, notify_bookings = excluded.notify_bookings, default_margin = excluded.default_margin, theme = excluded.theme, updated_at = excluded.updated_at;
  delete from public.account_favorites where user_id = account_id;
  insert into public.account_favorites (user_id, charger_id)
  select account_id, charger_id from unnest(p_favorites) as favorite(charger_id);
end;
$$;

grant execute on function public.replace_account_data(text[], jsonb, uuid, text[], numeric, text, boolean, boolean, boolean, numeric, text) to authenticated;
