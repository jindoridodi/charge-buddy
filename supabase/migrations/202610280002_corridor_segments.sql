-- Operational status is not live availability; repair values written by the earlier NREL importer.
update public.chargers set availability_status = 'unknown'
where source = 'nrel' and availability_status = 'available';

create or replace function public.corridor_chargers(route_points jsonb, max_detour_miles double precision)
returns setof public.chargers
language sql stable
as $$
  with points as (
    select (p.value ->> 'lat')::double precision as lat,
      (p.value ->> 'lng')::double precision as lng, p.ordinality
    from jsonb_array_elements(route_points) with ordinality as p
  ), segments as (
    select lat, lng, lead(lat) over (order by ordinality) as next_lat,
      lead(lng) over (order by ordinality) as next_lng
    from points
  ), bounds as (
    select min(lat) as min_lat, max(lat) as max_lat,
      min(lng) as min_lng, max(lng) as max_lng from points
  )
  select c.* from public.chargers c cross join bounds b
  where c.public_access and max_detour_miles between 0 and 50
    and c.latitude between b.min_lat - max_detour_miles / 69 and b.max_lat + max_detour_miles / 69
    and c.longitude between b.min_lng - max_detour_miles / (69 * cos(radians(c.latitude)))
      and b.max_lng + max_detour_miles / (69 * cos(radians(c.latitude)))
    and exists (
      select 1 from segments s
      cross join lateral (select 69 * cos(radians((c.latitude + s.lat + s.next_lat) / 3)) as scale) x
      cross join lateral (select (s.next_lng - s.lng) * x.scale as dx, (s.next_lat - s.lat) * 69 as dy,
        (c.longitude - s.lng) * x.scale as px, (c.latitude - s.lat) * 69 as py) v
      cross join lateral (select coalesce(greatest(0, least(1,
        (v.px * v.dx + v.py * v.dy) / nullif(v.dx * v.dx + v.dy * v.dy, 0))), 0) as t) projection
      where s.next_lat is not null
        and sqrt(power(v.px - projection.t * v.dx, 2) + power(v.py - projection.t * v.dy, 2)) <= max_detour_miles
    );
$$;
