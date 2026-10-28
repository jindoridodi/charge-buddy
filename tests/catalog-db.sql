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
