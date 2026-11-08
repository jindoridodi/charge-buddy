create table public.peer_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  address text not null check (char_length(trim(address)) between 1 and 200),
  area text not null check (char_length(trim(area)) between 1 and 100),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  connector text not null check (connector in ('J1772', 'CCS', 'NACS', 'CHAdeMO')),
  power_kw numeric not null check (power_kw > 0 and power_kw <= 1000),
  price numeric not null check (price > 0 and price < 10),
  published boolean not null default true
);
alter table public.peer_listings enable row level security;
create policy "accounts manage own peer listings" on public.peer_listings for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant select, insert, update, delete on public.peer_listings to authenticated;

-- Only coarse coordinates and a generic location label enter the public catalog.
create function public.project_peer_listing() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.chargers where id = old.id and source = 'peer';
    return old;
  end if;
  insert into public.chargers (id, name, address, latitude, longitude, connector_types, power_kw, source, public_access, operator_pricing)
  values (new.id, new.name, 'Approximate location', round(new.latitude::numeric, 1)::double precision, round(new.longitude::numeric, 1)::double precision, array[new.connector], new.power_kw, 'peer', new.published, '$' || new.price::text || '/kWh (host reported)')
  on conflict (id) do update set name = excluded.name, latitude = excluded.latitude, longitude = excluded.longitude,
    connector_types = excluded.connector_types, power_kw = excluded.power_kw, public_access = excluded.public_access, operator_pricing = excluded.operator_pricing
  where chargers.source = 'peer';
  return new;
end;
$$;
create trigger project_peer_listing after insert or update or delete on public.peer_listings for each row execute function public.project_peer_listing();
revoke all on public.peer_listings from authenticated;
grant select, delete on public.peer_listings to authenticated;
grant insert (name, address, area, latitude, longitude, connector, power_kw, price, published) on public.peer_listings to authenticated;
grant update (name, address, area, latitude, longitude, connector, power_kw, price, published) on public.peer_listings to authenticated;
drop policy "catalog is publicly readable" on public.chargers;
create policy "published catalog is publicly readable" on public.chargers for select using (public_access);
