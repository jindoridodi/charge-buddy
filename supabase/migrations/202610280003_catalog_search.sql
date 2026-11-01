-- Apply eligibility before the API sorts and paginates the national catalog.
create function public.search_catalog(
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
    and (c.community_price_per_kwh is null or c.community_price_per_kwh <= max_price)
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
