insert into public.chargers (id, nrel_station_id, name, address, latitude, longitude, power_kw)
values ('00000000-0000-0000-0000-000000000020', 2, 'Segment midpoint', 'Test only', 36.02, -120, 50);

set role anon;
do $$
begin
  if not exists (
    select 1 from public.corridor_chargers('[{"lat":36,"lng":-120},{"lat":36.04,"lng":-120}]', 1)
    where id = '00000000-0000-0000-0000-000000000020'
  ) then
    raise exception 'A charger directly on a route segment was excluded';
  end if;
  if exists (
    select 1 from public.corridor_chargers('[{"lat":37,"lng":-120},{"lat":37.04,"lng":-120}]', 1)
    where id = '00000000-0000-0000-0000-000000000020'
  ) then
    raise exception 'A charger outside the detour limit was included';
  end if;
end;
$$;
\echo 'PASS corridor includes segment midpoints and excludes distant chargers'

reset role;
insert into public.chargers (nrel_station_id, name, address, city, latitude, longitude, connector_types, power_kw, operational_status)
select 1000 + n, 'A ineligible ' || n, 'Test only', 'Boston', 42.36, -71.06, array['J1772'], 7.2, 'E'
from generate_series(1, 101) n;
insert into public.chargers (id, nrel_station_id, name, address, city, latitude, longitude, connector_types, power_kw, operational_status)
values ('00000000-0000-0000-0000-000000000030', 3, 'Z eligible', 'Test only', 'Boston', 42.36, -71.06, array['J1772COMBO'], 150, 'E');
set role anon;
do $$
declare result_id uuid;
begin
  select id into result_id from public.search_catalog(42.36, -71.06, 10, array['CCS', 'J1772COMBO'], array['DC Fast'], 0.5, 50, true)
  order by name, id limit 1;
  if result_id is distinct from '00000000-0000-0000-0000-000000000030'::uuid then
    raise exception 'Eligibility was not applied before pagination or the Boston origin was ignored';
  end if;
  if exists (select 1 from public.search_catalog(37.33, -121.88, 10, array['J1772COMBO'], '{}', 0.5, 0, false)) then
    raise exception 'The origin radius did not exclude distant stations';
  end if;
  if not exists (select 1 from public.search_catalog(null, null, 10, array['J1772COMBO'], '{}', 0.5, 0, false)) then
    raise exception 'Nationwide search required a San Jose origin';
  end if;
end;
$$;
\echo 'PASS national/location search and eligibility before pagination beyond 100 candidates'

reset role;
insert into public.community_price_reports (charger_id, reporter_id, price_per_kwh, observed_at)
values ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 0.35, (now() at time zone 'UTC')::date - 30),
  ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', 0.40, (now() at time zone 'UTC')::date - 31);
select set_config('TimeZone', case when extract(hour from now() at time zone 'UTC') < 12 then 'Etc/GMT+12' else 'Etc/GMT-14' end, false);
set role anon;
do $$
begin
  if (select community_price_per_kwh from public.catalog_charger_prices where id = '00000000-0000-0000-0000-000000000020') is distinct from 0.35 then
    raise exception 'UTC day-30 report was excluded in a different session time zone';
  end if;
  if (select community_price_per_kwh from public.catalog_charger_prices where id = '00000000-0000-0000-0000-000000000030') is not null then
    raise exception 'UTC day-31 report was included in a different session time zone';
  end if;
end;
$$;
reset role;
set timezone = 'UTC';
\echo 'PASS UTC price freshness is independent of the database session time zone'

reset role;
insert into public.chargers (id, nrel_station_id, name, address, latitude, longitude, connector_types, power_kw)
values ('00000000-0000-0000-0000-000000000140', 140, 'Near', 'Test only', 42.36, -71.06, array['QUOTE'], 50),
       ('00000000-0000-0000-0000-000000000141', 141, 'Far', 'Test only', 42.56, -71.06, array['QUOTE'], 50),
       ('00000000-0000-0000-0000-000000000142', 142, 'Unknown', 'Test only', 42.36, -71.06, array['QUOTE'], 50);
insert into public.community_price_reports (charger_id, reporter_id, price_per_kwh, observed_at)
values ('00000000-0000-0000-0000-000000000140', '00000000-0000-0000-0000-000000000001', 0.50, (now() at time zone 'UTC')::date),
       ('00000000-0000-0000-0000-000000000141', '00000000-0000-0000-0000-000000000001', 0.20, (now() at time zone 'UTC')::date);
set role anon;
do $$
declare ranked uuid[];
begin
  select array_agg(id) into ranked from public.search_catalog_ranked(42.36, -71.06, 30, array['QUOTE'], '{}', 10, 0, false, 20, 1);
  if ranked is distinct from array['00000000-0000-0000-0000-000000000140', '00000000-0000-0000-0000-000000000141', '00000000-0000-0000-0000-000000000142']::uuid[] then
    raise exception 'Expected near, far, unknown for low-efficiency vehicle, got %', ranked;
  end if;
  select array_agg(id) into ranked from public.search_catalog_ranked(42.36, -71.06, 30, array['QUOTE'], '{}', 10, 0, false, 20, 4);
  if ranked[1] is distinct from '00000000-0000-0000-0000-000000000141'::uuid then raise exception 'Vehicle efficiency did not change ranking'; end if;
  select array_agg(id) into ranked from public.search_catalog_ranked(42.36, -71.06, 30, array['QUOTE'], '{}', 10, 0, false, 50, 1);
  if ranked[1] is distinct from '00000000-0000-0000-0000-000000000141'::uuid then raise exception 'Requested energy did not change ranking'; end if;
  select array_agg(id) into ranked from public.search_catalog_ranked(42.56, -71.06, 30, array['QUOTE'], '{}', 10, 0, false, 20, 1);
  if ranked[1] is distinct from '00000000-0000-0000-0000-000000000141'::uuid then raise exception 'Origin did not change ranking'; end if;
end;
$$;
reset role;
\echo 'PASS quote ranking considers origin, energy, vehicle and unknown price'
