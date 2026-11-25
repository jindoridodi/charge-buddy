-- The ranked function returns rows in quote order before PostgREST applies pagination.
create function public.search_catalog_ranked(
  origin_lat double precision, origin_lng double precision, radius_miles double precision,
  connectors text[], levels text[], max_price numeric, min_power numeric, operational boolean,
  requested_kwh double precision, efficiency double precision
)
returns setof public.catalog_charger_prices
language plpgsql stable
as $$
begin
  return query
  select c.* from public.search_catalog(origin_lat, origin_lng, radius_miles, connectors, levels, max_price, min_power, operational) c
  order by (c.effective_price_per_kwh * requested_kwh +
    case when origin_lat is null then 0 else
      2 * 3958.8 * asin(sqrt(least(1,
        power(sin(radians(c.latitude - origin_lat) / 2), 2) +
        cos(radians(origin_lat)) * cos(radians(c.latitude)) * power(sin(radians(c.longitude - origin_lng) / 2), 2)
      ))) * 2 / efficiency * 0.32 end) nulls last, c.id;
end;
$$;
grant execute on function public.search_catalog_ranked(double precision, double precision, double precision, text[], text[], numeric, numeric, boolean, double precision, double precision) to anon, authenticated;
