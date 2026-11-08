alter table public.account_preferences add column revision bigint not null default 0;

create function public.read_account_data()
returns jsonb language plpgsql security invoker set search_path = public as $$
declare account_id uuid := auth.uid(); result jsonb;
begin
  if account_id is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(account_id::text, 0));
  select jsonb_build_object(
    'revision', coalesce(p.revision, 0),
    'favorites', coalesce((select jsonb_agg(charger_id) from public.account_favorites where user_id = account_id), '[]'::jsonb),
    'vehicles', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nickname', nickname, 'make', make, 'model', model, 'year', year, 'batteryKwh', battery_kwh, 'efficiency', efficiency, 'connector', connector)) from public.account_vehicles where user_id = account_id), '[]'::jsonb),
    'defaultVehicleId', p.default_vehicle_id,
    'settings', case when p.user_id is null then null else jsonb_build_object('connectors', p.connectors, 'maxDistance', p.max_distance, 'units', p.units, 'notifyEmail', p.notify_email, 'notifyPush', p.notify_push, 'notifyBookings', p.notify_bookings, 'defaultMargin', p.default_margin, 'theme', p.theme) end
  ) into result from (select 1) singleton left join public.account_preferences p on p.user_id = account_id;
  return result;
end;
$$;

create function public.save_account_data(
  p_revision bigint, p_favorites text[], p_vehicles jsonb, p_default_vehicle_id uuid,
  p_connectors text[], p_max_distance numeric, p_units text,
  p_notify_email boolean, p_notify_push boolean, p_notify_bookings boolean,
  p_default_margin numeric, p_theme text
) returns boolean language plpgsql security definer set search_path = public as $$
declare account_id uuid := auth.uid(); current_revision bigint;
begin
  if account_id is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(account_id::text, 0));
  select revision into current_revision from public.account_preferences where user_id = account_id;
  if coalesce(current_revision, 0) <> p_revision then return false; end if;
  perform public.replace_account_data(p_favorites, p_vehicles, p_default_vehicle_id, p_connectors, p_max_distance, p_units, p_notify_email, p_notify_push, p_notify_bookings, p_default_margin, p_theme);
  update public.account_preferences set revision = p_revision + 1 where user_id = account_id;
  return true;
end;
$$;
revoke execute on function public.replace_account_data(text[], jsonb, uuid, text[], numeric, text, boolean, boolean, boolean, numeric, text) from public, authenticated;
revoke execute on function public.read_account_data() from public;
revoke execute on function public.save_account_data(bigint, text[], jsonb, uuid, text[], numeric, text, boolean, boolean, boolean, numeric, text) from public;
grant execute on function public.read_account_data() to authenticated;
grant execute on function public.save_account_data(bigint, text[], jsonb, uuid, text[], numeric, text, boolean, boolean, boolean, numeric, text) to authenticated;

