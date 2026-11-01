-- Rank catalog pages in the database so pagination does not distort the
-- lowest-price result set. Only recent, visible community reports contribute.
create or replace view public.catalog_charger_prices
with (security_invoker = true) as
select
  chargers.*,
  latest.price_per_kwh as community_price_per_kwh,
  latest.observed_at as community_price_observed_at
from public.chargers
left join lateral (
  select price_per_kwh, observed_at
  from public.community_price_reports
  where charger_id = chargers.id
    and state = 'visible'
    and observed_at between current_date - 30 and current_date
  order by observed_at desc, created_at desc
  limit 1
) as latest on true;
