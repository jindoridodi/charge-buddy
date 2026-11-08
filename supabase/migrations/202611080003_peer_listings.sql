alter table public.chargers add column host_price_per_kwh numeric;

create table public.peer_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  address text not null check (char_length(trim(address)) between 1 and 200),
  area text not null check (char_length(area) <= 100 and area ~ '^[A-Za-z .''''-]+, [A-Z]{2}$'),
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
  insert into public.chargers (id, name, address, city, state, latitude, longitude, connector_types, power_kw, source, public_access, host_price_per_kwh)
  values (new.id, new.name, 'Approximate location', split_part(new.area, ', ', 1), split_part(new.area, ', ', 2), round(new.latitude::numeric, 1)::double precision, round(new.longitude::numeric, 1)::double precision, array[new.connector], new.power_kw, 'peer', new.published, new.price)
  on conflict (id) do update set name = excluded.name, latitude = excluded.latitude, longitude = excluded.longitude,
    city = excluded.city, state = excluded.state, connector_types = excluded.connector_types, power_kw = excluded.power_kw, public_access = excluded.public_access, host_price_per_kwh = excluded.host_price_per_kwh
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

-- Append public price fields without changing the existing view's column order.
create or replace view public.catalog_charger_prices with (security_invoker = true) as
select c.id, c.nrel_station_id, c.name, c.address, c.city, c.state, c.zip,
  c.latitude, c.longitude, c.network, c.connector_types, c.power_kw, c.operational_status,
  c.operator_pricing, c.source_updated_at, c.imported_at, c.source, c.source_external_id,
  c.public_access, c.availability_status, c.opening_hours_confidence, c.owner_id, c.updated_at,
  latest.price_per_kwh as community_price_per_kwh, latest.observed_at as community_price_observed_at,
  c.host_price_per_kwh,
  case when c.source = 'peer' then c.host_price_per_kwh else latest.price_per_kwh end as effective_price_per_kwh
from public.chargers c
left join lateral (
  select price_per_kwh, observed_at from public.community_price_reports
  where charger_id = c.id and state = 'visible'
    and observed_at between (now() at time zone 'UTC')::date - 30 and (now() at time zone 'UTC')::date
  order by observed_at desc, created_at desc limit 1
) latest on true;

-- Apply eligibility before the API sorts and paginates the national catalog.
create or replace function public.search_catalog(
  origin_lat double precision, origin_lng double precision, radius_miles double precision,
  connectors text[], levels text[], max_price numeric, min_power numeric, operational boolean
)
returns setof public.catalog_charger_prices
language sql stable
as $$
  select c.* from public.catalog_charger_prices c
  where c.public_access
    and (cardinality(connectors) = 0 or c.connector_types && connectors)
    and (cardinality(levels) = 0 or case
      when c.power_kw is null then null
      when c.power_kw <= 2 then 'Level 1'
      when c.power_kw < 20 then 'Level 2'
      else 'DC Fast' end = any(levels))
    and coalesce(c.power_kw, 0) >= min_power
    and (c.effective_price_per_kwh is null or c.effective_price_per_kwh <= max_price)
    and (not operational or c.operational_status = 'E')
    and ((origin_lat is null and origin_lng is null) or
      2 * 3958.8 * asin(sqrt(least(1,
        power(sin(radians(c.latitude - origin_lat) / 2), 2)
        + cos(radians(origin_lat)) * cos(radians(c.latitude))
          * power(sin(radians(c.longitude - origin_lng) / 2), 2)
      ))) <= radius_miles);
$$;

grant execute on function public.search_catalog(double precision, double precision, double precision, text[], text[], numeric, numeric, boolean)
to anon, authenticated;
