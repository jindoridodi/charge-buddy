create or replace function public.save_account_data(
  p_revision bigint, p_favorites text[], p_vehicles jsonb, p_default_vehicle_id uuid,
  p_connectors text[], p_max_distance numeric, p_units text,
  p_notify_email boolean, p_notify_push boolean, p_notify_bookings boolean,
  p_default_margin numeric, p_theme text
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare account_id uuid := auth.uid(); current_revision bigint;
begin
  if account_id is null then raise exception 'Authentication required'; end if;
  if p_revision is null or p_revision < 0 or p_favorites is null or cardinality(p_favorites) > 100
    or exists (select 1 from unnest(p_favorites) f where f is null or length(f) not between 1 and 100)
    or p_vehicles is null or jsonb_typeof(p_vehicles) <> 'array'
    or p_connectors is null or cardinality(p_connectors) > 4
    or exists (select 1 from unnest(p_connectors) c where c is null or c not in ('J1772', 'CCS', 'NACS', 'CHAdeMO'))
    or p_max_distance is null or p_max_distance::text = 'NaN' or p_max_distance not between 1 and 30
    or p_units is null or p_units not in ('mi', 'km')
    or p_notify_email is null or p_notify_push is null or p_notify_bookings is null
    or p_default_margin is null or p_default_margin::text = 'NaN' or p_default_margin not between 0 and 100
    or p_theme is null or p_theme not in ('light', 'dark') then
    raise exception 'Invalid account data' using errcode = '23514';
  end if;
  if jsonb_array_length(p_vehicles) > 20 or exists (
    select 1 from jsonb_array_elements(p_vehicles) v
    where jsonb_typeof(v) <> 'object'
      or coalesce(jsonb_typeof(v->'id'), '') <> 'string'
      or coalesce(jsonb_typeof(v->'nickname'), '') <> 'string' or length(trim(v->>'nickname')) not between 1 and 100
      or coalesce(jsonb_typeof(v->'make'), '') <> 'string' or length(trim(v->>'make')) not between 1 and 100
      or coalesce(jsonb_typeof(v->'model'), '') <> 'string' or length(trim(v->>'model')) not between 1 and 100
      or coalesce(jsonb_typeof(v->'year'), '') <> 'number'
      or coalesce(jsonb_typeof(v->'battery_kwh'), '') <> 'number'
      or coalesce(jsonb_typeof(v->'efficiency'), '') <> 'number'
      or coalesce(v->>'connector', '') not in ('J1772', 'CCS', 'NACS', 'CHAdeMO')
  ) then raise exception 'Invalid account data' using errcode = '23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended(account_id::text, 0));
  select revision into current_revision from public.account_preferences where user_id = account_id;
  if coalesce(current_revision, 0) <> p_revision then return false; end if;
  perform public.replace_account_data(p_favorites, p_vehicles, p_default_vehicle_id, p_connectors, p_max_distance, p_units, p_notify_email, p_notify_push, p_notify_bookings, p_default_margin, p_theme);
  update public.account_preferences set revision = p_revision + 1 where user_id = account_id;
  return true;
end;
$$;
