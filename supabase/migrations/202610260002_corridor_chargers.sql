create or replace function public.corridor_chargers(route_points jsonb, max_detour_miles double precision)
returns setof public.chargers
language sql
stable
as $$
  with points as (
    select
      (point.value ->> 'lat')::double precision as latitude,
      (point.value ->> 'lng')::double precision as longitude
    from jsonb_array_elements(route_points) as point
  ), bounds as (
    select min(latitude) as min_latitude, max(latitude) as max_latitude,
      min(longitude) as min_longitude, max(longitude) as max_longitude
    from points
  )
  select charger.*
  from public.chargers as charger
  cross join bounds
  where charger.public_access
    and charger.latitude between bounds.min_latitude - max_detour_miles / 69 and bounds.max_latitude + max_detour_miles / 69
    and charger.longitude between bounds.min_longitude - max_detour_miles / (69 * cos(radians(charger.latitude))) and bounds.max_longitude + max_detour_miles / (69 * cos(radians(charger.latitude)))
    and exists (
      select 1
      from points
      where sqrt(
        power((charger.latitude - points.latitude) * 69, 2)
        + power((charger.longitude - points.longitude) * 69 * cos(radians(points.latitude)), 2)
      ) <= max_detour_miles
    );
$$;

grant execute on function public.corridor_chargers(jsonb, double precision) to anon, authenticated;
